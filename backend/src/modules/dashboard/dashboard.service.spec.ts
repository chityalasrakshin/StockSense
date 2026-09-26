import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DashboardService } from './dashboard.service';
import { DashboardCacheService } from './services/dashboard-cache.service';

describe('DashboardService (Integration against Seeded Data)', () => {
  let moduleRef: TestingModule;
  let service: DashboardService;
  let prisma: PrismaService;
  let cacheService: DashboardCacheService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
      providers: [DashboardService, DashboardCacheService],
    }).compile();

    service = moduleRef.get<DashboardService>(DashboardService);
    prisma = moduleRef.get<PrismaService>(PrismaService);
    cacheService = moduleRef.get<DashboardCacheService>(DashboardCacheService);

    // Clean up any extra documents/balances created by concurrent integration tests
    const seedDocIds = [
      'd0000000-0000-0000-0000-000000000001',
      'd0000000-0000-0000-0000-000000000002',
      'd0000000-0000-0000-0000-000000000003',
      'd0000000-0000-0000-0000-000000000004',
      'd0000000-0000-0000-0000-000000000005',
    ];
    await prisma.stockLedger.deleteMany({
      where: { documentId: { notIn: seedDocIds } },
    });
    await prisma.documentLine.deleteMany({
      where: { documentId: { notIn: seedDocIds } },
    });
    await prisma.document.deleteMany({
      where: { id: { notIn: seedDocIds } },
    });

    const seedProduct = await prisma.product.findUnique({ where: { sku: 'STEEL-ROD-001' } });
    const mainWH = await prisma.location.findUnique({ where: { shortCode: 'WH' } });
    const prodRack = await prisma.location.findUnique({ where: { shortCode: 'WH-PR' } });
    if (seedProduct && mainWH && prodRack) {
      await prisma.stockBalance.upsert({
        where: { productId_locationId: { productId: seedProduct.id, locationId: mainWH.id } },
        update: { quantity: 47 },
        create: { productId: seedProduct.id, locationId: mainWH.id, quantity: 47 },
      });
      await prisma.stockBalance.upsert({
        where: { productId_locationId: { productId: seedProduct.id, locationId: prodRack.id } },
        update: { quantity: 30 },
        create: { productId: seedProduct.id, locationId: prodRack.id, quantity: 30 },
      });
      await prisma.stockBalance.deleteMany({
        where: { productId: { not: seedProduct.id } },
      });
    }

    const bolts = await prisma.product.findUnique({ where: { sku: 'BOLT-M12-100' } });
    const desk = await prisma.product.findUnique({ where: { sku: 'DESK-001' } });
    if (bolts && desk && mainWH) {
      await prisma.lowStockAlert.upsert({
        where: { productId_locationId: { productId: bolts.id, locationId: mainWH.id } },
        update: { currentStock: 0, reorderPoint: bolts.reorderPoint, status: 'OPEN' },
        create: { productId: bolts.id, locationId: mainWH.id, currentStock: 0, reorderPoint: bolts.reorderPoint, status: 'OPEN' },
      });
      await prisma.lowStockAlert.upsert({
        where: { productId_locationId: { productId: desk.id, locationId: mainWH.id } },
        update: { currentStock: 0, reorderPoint: desk.reorderPoint, status: 'OPEN' },
        create: { productId: desk.id, locationId: mainWH.id, currentStock: 0, reorderPoint: desk.reorderPoint, status: 'OPEN' },
      });
    }

    // Invalidate cache before tests run
    await cacheService.invalidateKpisCache();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await moduleRef.close();
  });

  describe('GET /dashboard/kpis - Operational KPI Accuracy', () => {
    it('should accurately calculate KPIs matching seeded data hand-checked calculations', async () => {
      // Clear cache so it computes directly from seeded database state
      await cacheService.invalidateKpisCache();

      const kpis = await service.getKpis();

      // Hand-checked expectations based on seed.ts:
      // 1. Total Products in Stock:
      //    Steel Rods (47kg at WH + 30kg at PR = 77kg > 0) -> IN STOCK (1)
      //    M12 Bolts (0 on hand) -> OUT OF STOCK
      //    Office Desk (0 on hand) -> OUT OF STOCK
      //    Expected count = 1
      expect(kpis.totalProductsInStock).toBe(1);
      expect(kpis.totalProducts).toBe(1);

      // 2. Low Stock / Out of Stock Items:
      //    Bolts (0 stock <= 50 reorder point) -> OPEN alert (1)
      //    Office Desk (0 stock <= 10 reorder point) -> OPEN alert (2)
      //    Steel Rods (77kg total > 25 reorder point) -> Healthy
      //    Expected count = 2
      expect(kpis.lowStockItems).toBe(2);
      expect(kpis.lowStockOrOutOfStockItems).toBe(2);

      // 3. Pending Receipts:
      //    WH/IN/00001 is DONE
      //    WH/IN/00002 is WAITING (Apex Metal 50kg)
      //    Expected count = 1
      expect(kpis.pendingReceipts).toBe(1);

      // 4. Pending Deliveries:
      //    WH/OUT/00002 (Azure Interior) is DONE
      //    No pending deliveries
      //    Expected count = 0
      expect(kpis.pendingDeliveries).toBe(0);

      // 5. Internal Transfers Scheduled:
      //    WH/OUT/00001 is DONE
      //    No pending transfers
      //    Expected count = 0
      expect(kpis.internalTransfersScheduled).toBe(0);
      expect(kpis.internalTransfersCount).toBe(0);

      // 6. Recent Ledger Activity:
      //    5 ledger entries seeded (doc1 receipt, doc2 transfer out/in, doc3 delivery, doc4 adjustment)
      expect(kpis.recentLedgerActivity).toBe(5);
    });

    it('should serve subsequent requests from cache until invalidated', async () => {
      // First call hydrates cache
      const first = await service.getKpis();
      expect(first).toBeDefined();

      // Cached call
      const cached = await cacheService.getCachedKpis();
      expect(cached).not.toBeNull();
      expect(cached?.totalProductsInStock).toBe(first.totalProductsInStock);
      expect(cached?.lowStockItems).toBe(first.lowStockItems);
    });
  });

  describe('GET /dashboard/filters-metadata - Dynamic Filters', () => {
    it('should return complete filter metadata for document types, statuses, warehouses, and categories', async () => {
      const filters = await service.getFiltersMetadata();

      // Document types
      expect(filters.documentTypes.map((t) => t.value)).toEqual([
        'RECEIPT',
        'DELIVERY',
        'TRANSFER',
        'ADJUSTMENT',
      ]);

      // Document statuses
      expect(filters.statuses.map((s) => s.value)).toEqual([
        'DRAFT',
        'WAITING',
        'READY',
        'DONE',
        'CANCELED',
      ]);

      // Seeded warehouses
      expect(filters.warehouses.length).toBeGreaterThanOrEqual(2);
      const whCodes = filters.warehouses.map((w) => w.shortCode);
      expect(whCodes).toContain('WH');
      expect(whCodes).toContain('WH-PR');

      // Seeded categories
      expect(filters.categories.length).toBeGreaterThanOrEqual(3);
      const catNames = filters.categories.map((c) => c.name);
      expect(catNames).toContain('Raw Materials');
      expect(catNames).toContain('Metals & Alloys');
    });
  });

  describe('GET /dashboard/alerts - Low Stock Drill-down', () => {
    it('should return paginated list of alerts filterable by OPEN/RESOLVED status', async () => {
      const openAlerts = await service.getAlerts({ status: 'OPEN', page: 1, limit: 10 });

      expect(openAlerts.items.length).toBe(2);
      expect(openAlerts.meta.totalItems).toBe(2);

      for (const alert of openAlerts.items) {
        expect(alert.status).toBe('OPEN');
        expect(alert.product).toBeDefined();
        expect(alert.location).toBeDefined();
        expect(alert.currentStock).toBeLessThanOrEqual(alert.reorderPoint);
      }

      const resolvedAlerts = await service.getAlerts({ status: 'RESOLVED', page: 1, limit: 10 });
      expect(resolvedAlerts.items.length).toBe(0);
      expect(resolvedAlerts.meta.totalItems).toBe(0);
    });

    it('should allow searching alerts by product SKU or name', async () => {
      const boltSearch = await service.getAlerts({ search: 'BOLT', page: 1, limit: 10 });
      expect(boltSearch.items.length).toBe(1);
      expect(boltSearch.items[0].product.sku).toBe('BOLT-M12-100');

      const deskSearch = await service.getAlerts({ search: 'Office Desk', page: 1, limit: 10 });
      expect(deskSearch.items.length).toBe(1);
      expect(deskSearch.items[0].product.name).toBe('Office Desk');
    });
  });
});
