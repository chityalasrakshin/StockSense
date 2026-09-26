import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { DocumentsService } from './documents.service';
import { IdempotencyService } from './services/idempotency.service';
import { EventPublisherService } from './services/event-publisher.service';
import { DocumentType, DocumentStatus, Role, LocationType } from '@prisma/client';

describe('Document Lifecycle & Concurrency Integration Tests', () => {
  let prisma: PrismaService;
  let ledgerService: LedgerService;
  let documentsService: DocumentsService;
  let idempotencyService: IdempotencyService;

  // Test entities created in live Postgres DB
  let testManager: { id: string; role: Role };
  let testStaff: { id: string; role: Role };
  let testProduct: { id: string; sku: string };
  let locMainWarehouse: { id: string; shortCode: string };
  let locProductionRack: { id: string; shortCode: string };

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    const configService = {
      get: (key: string, def?: any) => {
        if (key === 'REDIS_HOST') return 'localhost';
        if (key === 'REDIS_PORT') return 6379;
        return def;
      },
    } as any;

    idempotencyService = new IdempotencyService(configService);
    const eventPublisherService = new EventPublisherService(configService);
    ledgerService = new LedgerService(prisma);
    documentsService = new DocumentsService(
      prisma,
      ledgerService,
      idempotencyService,
      eventPublisherService,
    );

    // Bootstrap test users
    const uniqueSuffix = Date.now().toString().slice(-6);
    testManager = await prisma.user.upsert({
      where: { email: `test.mgr.${uniqueSuffix}@stocksense.dev` },
      update: {},
      create: {
        email: `test.mgr.${uniqueSuffix}@stocksense.dev`,
        passwordHash: 'dummy',
        role: Role.INVENTORY_MANAGER,
      },
    });

    testStaff = await prisma.user.upsert({
      where: { email: `test.staff.${uniqueSuffix}@stocksense.dev` },
      update: {},
      create: {
        email: `test.staff.${uniqueSuffix}@stocksense.dev`,
        passwordHash: 'dummy',
        role: Role.WAREHOUSE_STAFF,
      },
    });

    // Create test locations
    locMainWarehouse = await prisma.location.create({
      data: {
        name: `Main WH Test ${uniqueSuffix}`,
        shortCode: `WH-${uniqueSuffix}`,
        type: LocationType.WAREHOUSE,
      },
    });

    locProductionRack = await prisma.location.create({
      data: {
        name: `Prod Rack Test ${uniqueSuffix}`,
        shortCode: `PR-${uniqueSuffix}`,
        type: LocationType.RACK,
        parentId: locMainWarehouse.id,
      },
    });

    // Create test product
    testProduct = await prisma.product.create({
      data: {
        sku: `STEEL-${uniqueSuffix}`,
        name: 'Steel Rods Test Item',
        unitCost: 45.0,
        reorderPoint: 25,
        reorderQty: 100,
      },
    });
  });

  afterAll(async () => {
    // Cleanup test data created during test
    if (testProduct) {
      await prisma.stockLedger.deleteMany({ where: { productId: testProduct.id } });
      await prisma.stockBalance.deleteMany({ where: { productId: testProduct.id } });
      await prisma.documentLine.deleteMany({ where: { productId: testProduct.id } });
      await prisma.document.deleteMany({
        where: {
          OR: [
            { sourceLocationId: locMainWarehouse.id },
            { destLocationId: locMainWarehouse.id },
          ],
        },
      });
      await prisma.product.delete({ where: { id: testProduct.id } });
    }
    if (locProductionRack) {
      await prisma.location.delete({ where: { id: locProductionRack.id } });
    }
    if (locMainWarehouse) {
      await prisma.location.delete({ where: { id: locMainWarehouse.id } });
    }
    if (testManager) {
      await prisma.user.delete({ where: { id: testManager.id } });
    }
    if (testStaff) {
      await prisma.user.delete({ where: { id: testStaff.id } });
    }
    await prisma.$disconnect();
  });

  describe('5. PDF Worked Example Full Integration Flow', () => {

    it('Step 1 (RECEIPT): Receive 100kg steel into Main Warehouse -> balance = 100kg', async () => {
      const doc = await documentsService.create(
        {
          type: DocumentType.RECEIPT,
          destLocationId: locMainWarehouse.id,
          contact: 'Vandertramp Steels Ltd.',
          partnerRef: 'PO-STEEL-001',
          lines: [{ productId: testProduct.id, expectedQty: 100 }],
        },
        testManager,
      );

      // Validate receipt
      const validated = await documentsService.validate(doc.id, testStaff.id);
      expect(validated.status).toBe(DocumentStatus.DONE);

      // Verify stock balances
      const balWh = await ledgerService.getBalance(testProduct.id, locMainWarehouse.id);
      expect(balWh).toBe(100);

      // Verify ledger entries
      const ledger = await prisma.stockLedger.findMany({
        where: { documentId: doc.id },
      });
      expect(ledger.length).toBe(1);
      expect(ledger[0].qtyDelta).toBe(100);
      expect(ledger[0].balanceAfter).toBe(100);
      expect(ledger[0].locationId).toBe(locMainWarehouse.id);
    });

    it('Step 2 (INTERNAL TRANSFER): Transfer 30kg from Main Warehouse to Production Rack -> WH=70kg, Rack=30kg', async () => {
      const doc = await documentsService.create(
        {
          type: DocumentType.TRANSFER,
          sourceLocationId: locMainWarehouse.id,
          destLocationId: locProductionRack.id,
          lines: [{ productId: testProduct.id, expectedQty: 30 }],
        },
        testStaff,
      );

      // Validate internal transfer
      const validated = await documentsService.validate(doc.id, testStaff.id);
      expect(validated.status).toBe(DocumentStatus.DONE);

      // Verify balances
      const balWh = await ledgerService.getBalance(testProduct.id, locMainWarehouse.id);
      const balRack = await ledgerService.getBalance(testProduct.id, locProductionRack.id);
      expect(balWh).toBe(70); // 100 - 30
      expect(balRack).toBe(30); // 0 + 30

      // Verify ledger entries (exact dual entry in single transaction: source -30, dest +30)
      const ledger = await prisma.stockLedger.findMany({
        where: { documentId: doc.id },
        orderBy: { qtyDelta: 'asc' },
      });
      expect(ledger.length).toBe(2);
      expect(ledger[0].locationId).toBe(locMainWarehouse.id);
      expect(ledger[0].qtyDelta).toBe(-30);
      expect(ledger[0].balanceAfter).toBe(70);

      expect(ledger[1].locationId).toBe(locProductionRack.id);
      expect(ledger[1].qtyDelta).toBe(30);
      expect(ledger[1].balanceAfter).toBe(30);
    });

    it('Step 3 (DELIVERY): Deliver 20kg from Main Warehouse to Azure Interior -> WH=50kg, Rack=30kg', async () => {
      const doc = await documentsService.create(
        {
          type: DocumentType.DELIVERY,
          sourceLocationId: locMainWarehouse.id,
          contact: 'Azure Interior',
          lines: [{ productId: testProduct.id, expectedQty: 20 }],
        },
        testManager,
      );

      const validated = await documentsService.validate(doc.id, testStaff.id);
      expect(validated.status).toBe(DocumentStatus.DONE);

      const balWh = await ledgerService.getBalance(testProduct.id, locMainWarehouse.id);
      const balRack = await ledgerService.getBalance(testProduct.id, locProductionRack.id);
      expect(balWh).toBe(50); // 70 - 20
      expect(balRack).toBe(30); // unchanged

      const ledger = await prisma.stockLedger.findMany({
        where: { documentId: doc.id },
      });
      expect(ledger.length).toBe(1);
      expect(ledger[0].qtyDelta).toBe(-20);
      expect(ledger[0].balanceAfter).toBe(50);
    });

    it('Step 4 (ADJUSTMENT): Count 47kg at Main Warehouse (scrap/loss -3kg) -> WH=47kg, Rack=30kg, Total=77kg', async () => {
      const doc = await documentsService.create(
        {
          type: DocumentType.ADJUSTMENT,
          sourceLocationId: locMainWarehouse.id,
          contact: 'Scrap / Quality Control',
          lines: [{ productId: testProduct.id, expectedQty: 50, actualQty: 47 }], // counted 47kg
        },
        testManager,
      );

      const validated = await documentsService.validate(doc.id, testManager.id);
      expect(validated.status).toBe(DocumentStatus.DONE);

      const balWh = await ledgerService.getBalance(testProduct.id, locMainWarehouse.id);
      const balRack = await ledgerService.getBalance(testProduct.id, locProductionRack.id);
      expect(balWh).toBe(47); // 50 - 3
      expect(balRack).toBe(30); // 30
      expect(balWh + balRack).toBe(77); // exactly 77kg total in system per PDF

      const ledger = await prisma.stockLedger.findMany({
        where: { documentId: doc.id },
      });
      expect(ledger.length).toBe(1);
      expect(ledger[0].qtyDelta).toBe(-3);
      expect(ledger[0].balanceAfter).toBe(47);
    });

    it('Step 5: Move History endpoint returns exactly 5 entries in descending order matching PDF steps', async () => {
      const history = await ledgerService.findMoveHistory({
        product: testProduct.id,
        limit: 10,
      });

      expect(history.items.length).toBe(5);
      // Entry 1 (most recent): Adjustment delta -3kg at WH
      expect(history.items[0].qtyDelta).toBe(-3);
      expect(history.items[0].balanceAfter).toBe(47);
      // Entry 2: Delivery outflow -20kg at WH
      expect(history.items[1].qtyDelta).toBe(-20);
      expect(history.items[1].balanceAfter).toBe(50);
      // Entry 3 & 4: Transfer (+30 into Rack, -30 out of WH)
      expect(Math.abs(history.items[2].qtyDelta)).toBe(30);
      expect(Math.abs(history.items[3].qtyDelta)).toBe(30);
      // Entry 5 (earliest): Receipt +100kg into WH
      expect(history.items[4].qtyDelta).toBe(100);
      expect(history.items[4].balanceAfter).toBe(100);
    });

    it('Step 6: Idempotency-Key prevents double posting on duplicate validate request', async () => {
      const doc = await documentsService.create(
        {
          type: DocumentType.RECEIPT,
          destLocationId: locMainWarehouse.id,
          lines: [{ productId: testProduct.id, expectedQty: 10 }],
        },
        testManager,
      );

      const idempKey = `idemp-${Date.now()}`;

      // First submit
      const res1 = await documentsService.validate(doc.id, testStaff.id, idempKey);
      expect(res1.status).toBe(DocumentStatus.DONE);

      const balAfterFirst = await ledgerService.getBalance(testProduct.id, locMainWarehouse.id);

      // Duplicate network submit with same Idempotency-Key
      const res2 = await documentsService.validate(doc.id, testStaff.id, idempKey);
      expect(res2.status).toBe(DocumentStatus.DONE);

      const balAfterSecond = await ledgerService.getBalance(testProduct.id, locMainWarehouse.id);

      // Balance MUST be unchanged (no double posting)
      expect(balAfterSecond).toBe(balAfterFirst);

      // Exactly 1 ledger entry for this document
      const entries = await prisma.stockLedger.findMany({ where: { documentId: doc.id } });
      expect(entries.length).toBe(1);
    });
  });

  describe('6. MANDATORY CONCURRENCY TESTS (10 Iteration Stability Loop)', () => {
    /**
     * Architecture.md section 14:
     * "The single highest-value test in the whole suite: simulate two simultaneous validations
     * against the same product/location to prove SELECT ... FOR UPDATE row-locking prevents
     * double-counting and prevents negative stock."
     */
    for (let iteration = 1; iteration <= 10; iteration++) {
      it(`Concurrency Iteration #${iteration}: 2 concurrent delivery requests exceeding stock serialize cleanly with 1 success and 1 rejection (no negative balance)`, async () => {
        const iterSuffix = `${Date.now()}-${iteration}`;
        const cProduct = await prisma.product.create({
          data: {
            sku: `CONCUR-ITEM-${iterSuffix}`,
            name: `Concurrency Item ${iteration}`,
            unitCost: 10,
          },
        });

        // Initialize balance to exactly 10 units
        await ledgerService.append({
          productId: cProduct.id,
          locationId: locMainWarehouse.id,
          qtyDelta: 10,
          actorId: testManager.id,
        });

        // Create two simultaneous Delivery documents: Doc1 requests 7 units, Doc2 requests 6 units (total 13 > 10)
        const doc1 = await documentsService.create(
          {
            type: DocumentType.DELIVERY,
            sourceLocationId: locMainWarehouse.id,
            lines: [{ productId: cProduct.id, expectedQty: 7 }],
          },
          testStaff,
        );

        const doc2 = await documentsService.create(
          {
            type: DocumentType.DELIVERY,
            sourceLocationId: locMainWarehouse.id,
            lines: [{ productId: cProduct.id, expectedQty: 6 }],
          },
          testStaff,
        );

        // Fire both validate transactions at the EXACT same time
        const results = await Promise.allSettled([
          documentsService.validate(doc1.id, testStaff.id),
          documentsService.validate(doc2.id, testStaff.id),
        ]);

        const fulfilled = results.filter((r) => r.status === 'fulfilled');
        const rejected = results.filter((r) => r.status === 'rejected');

        // Exactly one document must succeed, and exactly one must fail due to insufficient stock
        expect(fulfilled.length).toBe(1);
        expect(rejected.length).toBe(1);

        const rejectionError = (rejected[0] as PromiseRejectedResult).reason;
        expect(rejectionError).toBeInstanceOf(ConflictException);
        expect(rejectionError.message).toContain('Insufficient stock');

        // Verify the final database stock balance is non-negative and matches the winning transaction
        const finalBalance = await ledgerService.getBalance(cProduct.id, locMainWarehouse.id);
        expect([3, 4]).toContain(finalBalance); // 10 - 7 = 3 (if doc1 won) or 10 - 6 = 4 (if doc2 won)
        expect(finalBalance).toBeGreaterThanOrEqual(0);

        // Cleanup iteration records
        await prisma.stockLedger.deleteMany({ where: { productId: cProduct.id } });
        await prisma.stockBalance.deleteMany({ where: { productId: cProduct.id } });
        await prisma.documentLine.deleteMany({ where: { productId: cProduct.id } });
        await prisma.document.deleteMany({ where: { id: { in: [doc1.id, doc2.id] } } });
        await prisma.product.delete({ where: { id: cProduct.id } });
      });
    }

    it('Concurrent valid deliveries (sufficient balance): both serialize and deduct accurately', async () => {
      const iterSuffix = `${Date.now()}-sufficient`;
      const cProduct = await prisma.product.create({
        data: {
          sku: `CONCUR-SUFFICIENT-${iterSuffix}`,
          name: 'Concurrency Sufficient Test',
          unitCost: 10,
        },
      });

      // Initial balance = 20 units
      await ledgerService.append({
        productId: cProduct.id,
        locationId: locMainWarehouse.id,
        qtyDelta: 20,
        actorId: testManager.id,
      });

      // Doc1 requests 7 units, Doc2 requests 6 units (total 13 <= 20)
      const doc1 = await documentsService.create(
        {
          type: DocumentType.DELIVERY,
          sourceLocationId: locMainWarehouse.id,
          lines: [{ productId: cProduct.id, expectedQty: 7 }],
        },
        testStaff,
      );

      const doc2 = await documentsService.create(
        {
          type: DocumentType.DELIVERY,
          sourceLocationId: locMainWarehouse.id,
          lines: [{ productId: cProduct.id, expectedQty: 6 }],
        },
        testStaff,
      );

      // Fire both concurrently
      const [res1, res2] = await Promise.all([
        documentsService.validate(doc1.id, testStaff.id),
        documentsService.validate(doc2.id, testStaff.id),
      ]);

      expect(res1.status).toBe(DocumentStatus.DONE);
      expect(res2.status).toBe(DocumentStatus.DONE);

      // Final balance must be EXACTLY 20 - 7 - 6 = 7
      const finalBalance = await ledgerService.getBalance(cProduct.id, locMainWarehouse.id);
      expect(finalBalance).toBe(7);

      // Cleanup
      await prisma.stockLedger.deleteMany({ where: { productId: cProduct.id } });
      await prisma.stockBalance.deleteMany({ where: { productId: cProduct.id } });
      await prisma.documentLine.deleteMany({ where: { productId: cProduct.id } });
      await prisma.document.deleteMany({ where: { id: { in: [doc1.id, doc2.id] } } });
      await prisma.product.delete({ where: { id: cProduct.id } });
    });
  });
});
