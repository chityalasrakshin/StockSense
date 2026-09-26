import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: any;

  beforeEach(async () => {
    service = {
      getKpis: jest.fn().mockResolvedValue({
        totalProductsInStock: 1,
        totalProducts: 1,
        lowStockItems: 2,
        lowStockOrOutOfStockItems: 2,
        pendingReceipts: 1,
        pendingDeliveries: 0,
        internalTransfersScheduled: 0,
        internalTransfersCount: 0,
        recentLedgerActivity: 5,
      }),
      getFiltersMetadata: jest.fn().mockResolvedValue({
        documentTypes: [{ label: 'Receipts', value: 'RECEIPT' }],
        statuses: [{ label: 'Draft', value: 'DRAFT' }],
        warehouses: [{ id: 'w1', name: 'Main WH', label: 'Main WH', value: 'w1', shortCode: 'WH', type: 'WAREHOUSE' }],
        categories: [{ id: 'c1', name: 'Raw', label: 'Raw', value: 'c1', parentId: null }],
      }),
      getAlerts: jest.fn().mockResolvedValue({
        items: [
          {
            id: 'a1',
            productId: 'p1',
            locationId: 'l1',
            currentStock: 0,
            currentBalance: 0,
            reorderPoint: 50,
            status: 'OPEN',
            openedAt: new Date().toISOString(),
            resolvedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            product: { id: 'p1', sku: 'BOLT-1', name: 'Bolts', unitCost: 1.25 },
            location: { id: 'l1', name: 'Main WH', shortCode: 'WH' },
          },
        ],
        meta: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: service }],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
  });

  it('GET /dashboard/kpis delegates to service', async () => {
    const kpis = await controller.getKpis();
    expect(kpis.totalProductsInStock).toBe(1);
    expect(kpis.lowStockItems).toBe(2);
    expect(service.getKpis).toHaveBeenCalled();
  });

  it('GET /dashboard/filters-metadata delegates to service', async () => {
    const filters = await controller.getFiltersMetadata();
    expect(filters.documentTypes).toHaveLength(1);
    expect(service.getFiltersMetadata).toHaveBeenCalled();
  });

  it('GET /dashboard/alerts delegates to service with query params', async () => {
    const alerts = await controller.getAlerts({ status: 'OPEN', page: 1, limit: 10 });
    expect(alerts.items).toHaveLength(1);
    expect(service.getAlerts).toHaveBeenCalledWith({ status: 'OPEN', page: 1, limit: 10 });
  });
});
