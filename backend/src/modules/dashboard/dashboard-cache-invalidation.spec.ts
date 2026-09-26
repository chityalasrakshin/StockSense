import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { DocumentType, Role } from '@prisma/client';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DocumentsModule } from '../documents/documents.module';
import { DocumentsService } from '../documents/documents.service';
import { DashboardModule } from './dashboard.module';
import { DashboardService } from './dashboard.service';
import { DashboardCacheService } from './services/dashboard-cache.service';

describe('Dashboard Redis Cache Invalidation on Document Validation', () => {
  let moduleRef: TestingModule;
  let dashboardService: DashboardService;
  let documentsService: DocumentsService;
  let cacheService: DashboardCacheService;
  let prisma: PrismaService;

  const testUser = {
    id: 'a0000000-0000-0000-0000-000000000001', // Seeded manager
    role: Role.INVENTORY_MANAGER,
  };

  let createdDocId: string | null = null;
  let steelProductId: string | null = null;
  let mainWarehouseId: string | null = null;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        DocumentsModule,
        DashboardModule,
      ],
    }).compile();

    await moduleRef.init();

    dashboardService = moduleRef.get<DashboardService>(DashboardService);
    documentsService = moduleRef.get<DocumentsService>(DocumentsService);
    cacheService = moduleRef.get<DashboardCacheService>(DashboardCacheService);
    prisma = moduleRef.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    if (createdDocId) {
      await prisma.stockLedger.deleteMany({ where: { documentId: createdDocId } });
      await prisma.documentLine.deleteMany({ where: { documentId: createdDocId } });
      await prisma.document.deleteMany({ where: { id: createdDocId } });
      if (steelProductId && mainWarehouseId) {
        await prisma.stockBalance.upsert({
          where: {
            productId_locationId: {
              productId: steelProductId,
              locationId: mainWarehouseId,
            },
          },
          update: { quantity: 47 },
          create: { productId: steelProductId, locationId: mainWarehouseId, quantity: 47 },
        });
      }
    }
    await cacheService.invalidateKpisCache();
    await prisma.$disconnect();
    await moduleRef.close();
  });

  it('proves Redis cache invalidates correctly after a validate() call changes the picture', async () => {
    const steelProduct = await prisma.product.findUniqueOrThrow({
      where: { sku: 'STEEL-ROD-001' },
    });
    const mainWarehouse = await prisma.location.findUniqueOrThrow({
      where: { shortCode: 'WH' },
    });

    steelProductId = steelProduct.id;
    mainWarehouseId = mainWarehouse.id;

    // 1. Create a draft receipt for Steel Rods (+5kg)
    const newDoc = await documentsService.create(
      {
        type: DocumentType.RECEIPT,
        destLocationId: mainWarehouse.id,
        contact: 'Cache Test Supplier Ltd',
        lines: [
          {
            productId: steelProduct.id,
            expectedQty: 5,
          },
        ],
      },
      testUser,
    );
    createdDocId = newDoc.id;

    // 2. Fetch KPIs to warm the cache BEFORE validation
    const kpisBeforeValidation = await dashboardService.getKpis();
    expect(kpisBeforeValidation).toBeDefined();

    // Verify cache is currently warm
    const cachedBefore = await cacheService.getCachedKpis();
    expect(cachedBefore).not.toBeNull();
    expect(cachedBefore?.recentLedgerActivity).toBe(kpisBeforeValidation.recentLedgerActivity);

    // 3. Validate the document — this triggers transactional ledger write, balance update,
    // and emits stock.changed + document.status_changed
    await documentsService.validate(newDoc.id, testUser.id);

    // 4. ASSERTION: Cache is immediately invalidated proactively (not waiting for TTL)
    const cachedAfter = await cacheService.getCachedKpis();
    expect(cachedAfter).toBeNull();

    // 5. Next KPI fetch computes fresh data showing updated recent ledger activity
    const updatedKpis = await dashboardService.getKpis();
    expect(updatedKpis.recentLedgerActivity).toBe(kpisBeforeValidation.recentLedgerActivity + 1);

    // 6. Verify cache is re-hydrated with fresh numbers
    const cachedFresh = await cacheService.getCachedKpis();
    expect(cachedFresh).not.toBeNull();
    expect(cachedFresh?.recentLedgerActivity).toBe(updatedKpis.recentLedgerActivity);
  });
});
