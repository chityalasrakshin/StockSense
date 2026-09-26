import {
  evaluateReorderThreshold,
  LowStockAlertService,
} from '../services/low-stock-alert.service';

describe('Low Stock Alert Worker & Reorder Threshold Evaluation', () => {
  describe('evaluateReorderThreshold (Unit Tests)', () => {
    it('crossing down opens an alert when stock drops at or below reorderPoint from healthy state', () => {
      // Scenario A: Product had healthy stock (previousStatus was null), drops to 15 (reorderPoint = 20)
      const res1 = evaluateReorderThreshold({
        currentBalance: 15,
        reorderPoint: 20,
        previousStatus: null,
      });

      expect(res1.action).toBe('OPEN_ALERT');
      expect(res1.nextStatus).toBe('OPEN');
      expect(res1.shouldPublish).toBe(true);

      // Scenario B: Product was previously RESOLVED, drops exactly to reorderPoint (20)
      const res2 = evaluateReorderThreshold({
        currentBalance: 20,
        reorderPoint: 20,
        previousStatus: 'RESOLVED',
      });

      expect(res2.action).toBe('OPEN_ALERT');
      expect(res2.nextStatus).toBe('OPEN');
      expect(res2.shouldPublish).toBe(true);

      // Scenario C: Product drops to 0 (out of stock)
      const res3 = evaluateReorderThreshold({
        currentBalance: 0,
        reorderPoint: 10,
        previousStatus: null,
      });

      expect(res3.action).toBe('OPEN_ALERT');
      expect(res3.nextStatus).toBe('OPEN');
      expect(res3.shouldPublish).toBe(true);
    });

    it('recovering above closes (auto-resolves) an active alert when stock increases above reorderPoint', () => {
      // Scenario: Product had OPEN alert, receives shipment bringing balance to 25 (reorderPoint = 20)
      const res = evaluateReorderThreshold({
        currentBalance: 25,
        reorderPoint: 20,
        previousStatus: 'OPEN',
      });

      expect(res.action).toBe('RESOLVE_ALERT');
      expect(res.nextStatus).toBe('RESOLVED');
      expect(res.shouldPublish).toBe(true);
    });

    it('staying flat or moving within the same state does not trigger redundant alert transitions (NO_OP or UPDATE_STOCK)', () => {
      // Scenario A: Product is already OPEN and drops further (from 15 to 10 with reorderPoint = 20)
      const res1 = evaluateReorderThreshold({
        currentBalance: 10,
        reorderPoint: 20,
        previousStatus: 'OPEN',
      });

      expect(res1.action).toBe('UPDATE_STOCK');
      expect(res1.nextStatus).toBe('OPEN');
      expect(res1.shouldPublish).toBe(false);

      // Scenario B: Product remains above threshold without any prior alert
      const res2 = evaluateReorderThreshold({
        currentBalance: 50,
        reorderPoint: 20,
        previousStatus: null,
      });

      expect(res2.action).toBe('NO_OP');
      expect(res2.nextStatus).toBeNull();
      expect(res2.shouldPublish).toBe(false);

      // Scenario C: Product remains above threshold with already RESOLVED state
      const res3 = evaluateReorderThreshold({
        currentBalance: 55,
        reorderPoint: 20,
        previousStatus: 'RESOLVED',
      });

      expect(res3.action).toBe('UPDATE_STOCK');
      expect(res3.nextStatus).toBe('RESOLVED');
      expect(res3.shouldPublish).toBe(false);
    });
  });

  describe('LowStockAlertService (Service Integration)', () => {
    let mockPrisma: any;
    let mockRedis: any;
    let service: LowStockAlertService;

    const mockProduct = {
      id: 'p-steel-1',
      sku: 'STEEL-001',
      name: 'Steel Rods',
      reorderPoint: 25,
    };

    beforeEach(() => {
      mockPrisma = {
        product: {
          findUnique: jest.fn().mockResolvedValue(mockProduct),
        },
        lowStockAlert: {
          findUnique: jest.fn(),
          upsert: jest.fn(),
          update: jest.fn(),
        },
      };

      mockRedis = {
        status: 'ready',
        publish: jest.fn().mockResolvedValue(1),
      };

      service = new LowStockAlertService(mockPrisma, mockRedis);
    });

    it('should upsert an OPEN alert and publish alert.low_stock event when balance <= reorderPoint', async () => {
      mockPrisma.lowStockAlert.findUnique.mockResolvedValue(null);
      mockPrisma.lowStockAlert.upsert.mockResolvedValue({
        id: 'alert-1',
        productId: mockProduct.id,
        locationId: 'loc-1',
        currentStock: 20,
        reorderPoint: 25,
        status: 'OPEN',
        openedAt: new Date(),
      });

      const result = await service.processStockChanged({
        productId: mockProduct.id,
        locationId: 'loc-1',
        currentBalance: 20, // 20 <= 25
      });

      expect(result.action).toBe('OPEN_ALERT');
      expect(result.status).toBe('OPEN');
      expect(mockPrisma.lowStockAlert.upsert).toHaveBeenCalledWith({
        where: {
          productId_locationId: {
            productId: mockProduct.id,
            locationId: 'loc-1',
          },
        },
        update: expect.objectContaining({
          currentStock: 20,
          status: 'OPEN',
        }),
        create: expect.objectContaining({
          productId: mockProduct.id,
          locationId: 'loc-1',
          currentStock: 20,
          status: 'OPEN',
        }),
      });

      expect(mockRedis.publish).toHaveBeenCalledWith(
        'alert.low_stock',
        expect.stringContaining('"status":"OPEN"'),
      );
    });

    it('should auto-resolve the existing alert and publish RESOLVED status when balance recovers > reorderPoint', async () => {
      // Existing OPEN alert
      mockPrisma.lowStockAlert.findUnique.mockResolvedValue({
        id: 'alert-1',
        productId: mockProduct.id,
        locationId: 'loc-1',
        currentStock: 20,
        reorderPoint: 25,
        status: 'OPEN',
      });

      mockPrisma.lowStockAlert.update.mockResolvedValue({
        id: 'alert-1',
        productId: mockProduct.id,
        locationId: 'loc-1',
        currentStock: 30,
        reorderPoint: 25,
        status: 'RESOLVED',
        resolvedAt: new Date(),
      });

      const result = await service.processStockChanged({
        productId: mockProduct.id,
        locationId: 'loc-1',
        currentBalance: 30, // 30 > 25
      });

      expect(result.action).toBe('RESOLVE_ALERT');
      expect(result.status).toBe('RESOLVED');
      expect(mockPrisma.lowStockAlert.update).toHaveBeenCalledWith({
        where: { id: 'alert-1' },
        data: expect.objectContaining({
          currentStock: 30,
          status: 'RESOLVED',
          resolvedAt: expect.any(Date),
        }),
      });

      expect(mockRedis.publish).toHaveBeenCalledWith(
        'alert.low_stock',
        expect.stringContaining('"status":"RESOLVED"'),
      );
    });
  });
});
