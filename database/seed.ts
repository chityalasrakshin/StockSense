import * as path from 'path';
import * as dotenv from 'dotenv';
import { PrismaClient, Role, LocationType, DocumentType, DocumentStatus } from '@prisma/client';

// Load environment variables from backend/.env if available
dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.DATABASE_URL ||
        'postgresql://stocksense:stocksense@localhost:5432/stocksense?schema=public',
    },
  },
});

// Deterministic UUIDs for seed records to ensure complete idempotency
const IDS = {
  user: {
    manager: 'a0000000-0000-0000-0000-000000000001',
    staff: 'a0000000-0000-0000-0000-000000000002',
  },
  category: {
    rawMaterials: 'c0000000-0000-0000-0000-000000000001',
    metals: 'c0000000-0000-0000-0000-000000000002',
    fasteners: 'c0000000-0000-0000-0000-000000000003',
  },
  uom: {
    kg: 'u0000000-0000-0000-0000-000000000001',
    pcs: 'u0000000-0000-0000-0000-000000000002',
    box: 'u0000000-0000-0000-0000-000000000003',
  },
  product: {
    steelRods: 'p0000000-0000-0000-0000-000000000001',
    boltsM12: 'p0000000-0000-0000-0000-000000000002',
  },
  location: {
    mainWarehouse: 'l0000000-0000-0000-0000-000000000001',
    productionRack: 'l0000000-0000-0000-0000-000000000002',
    receivingBay: 'l0000000-0000-0000-0000-000000000003',
  },
  document: {
    doc1Receipt: 'd0000000-0000-0000-0000-000000000001',
    doc2Transfer: 'd0000000-0000-0000-0000-000000000002',
    doc3Delivery: 'd0000000-0000-0000-0000-000000000003',
    doc4Adjustment: 'd0000000-0000-0000-0000-000000000004',
    doc5PendingReceipt: 'd0000000-0000-0000-0000-000000000005',
  },
  line: {
    line1: 'f0000000-0000-0000-0000-000000000001',
    line2: 'f0000000-0000-0000-0000-000000000002',
    line3: 'f0000000-0000-0000-0000-000000000003',
    line4: 'f0000000-0000-0000-0000-000000000004',
    line5: 'f0000000-0000-0000-0000-000000000005',
  },
  ledger: {
    entry1Receipt: 'e0000000-0000-0000-0000-000000000001',
    entry2TransferOut: 'e0000000-0000-0000-0000-000000000002',
    entry3TransferIn: 'e0000000-0000-0000-0000-000000000003',
    entry4DeliveryOut: 'e0000000-0000-0000-0000-000000000004',
    entry5AdjustmentDelta: 'e0000000-0000-0000-0000-000000000005',
  },
};

// Default password hash for 'password123' (bcrypt cost 10)
const DEMO_PASSWORD_HASH = '$2b$10$ep/0tT0nKq3fGzN4/eZseeg5e1PcvbK/m85yLqgLsqYkWgNnQkH9q';

async function main() {
  console.log('🌱 Starting StockSense demo dataset seeding...');

  // 1. Demo Users (Inventory Manager + Warehouse Staff)
  const manager = await prisma.user.upsert({
    where: { email: 'manager@stocksense.dev' },
    update: {
      role: Role.INVENTORY_MANAGER,
      isActive: true,
    },
    create: {
      id: IDS.user.manager,
      email: 'manager@stocksense.dev',
      passwordHash: DEMO_PASSWORD_HASH,
      role: Role.INVENTORY_MANAGER,
      isActive: true,
    },
  });

  const staff = await prisma.user.upsert({
    where: { email: 'staff@stocksense.dev' },
    update: {
      role: Role.WAREHOUSE_STAFF,
      isActive: true,
    },
    create: {
      id: IDS.user.staff,
      email: 'staff@stocksense.dev',
      passwordHash: DEMO_PASSWORD_HASH,
      role: Role.WAREHOUSE_STAFF,
      isActive: true,
    },
  });

  console.log(
    `  ✓ Users seeded: ${manager.email} (${manager.role}), ${staff.email} (${staff.role})`,
  );

  // 2. Units of Measure
  const uomKg = await prisma.unitOfMeasure.upsert({
    where: { code: 'kg' },
    update: { name: 'Kilograms' },
    create: {
      id: IDS.uom.kg,
      code: 'kg',
      name: 'Kilograms',
    },
  });

  const uomPcs = await prisma.unitOfMeasure.upsert({
    where: { code: 'pcs' },
    update: { name: 'Pieces' },
    create: {
      id: IDS.uom.pcs,
      code: 'pcs',
      name: 'Pieces',
    },
  });

  await prisma.unitOfMeasure.upsert({
    where: { code: 'box' },
    update: { name: 'Boxes' },
    create: {
      id: IDS.uom.box,
      code: 'box',
      name: 'Boxes',
    },
  });

  console.log(`  ✓ Units of Measure seeded: kg, pcs, box`);

  // 3. Categories (Tree hierarchy)
  const catRawMaterials = await prisma.category.upsert({
    where: { name: 'Raw Materials' },
    update: {},
    create: {
      id: IDS.category.rawMaterials,
      name: 'Raw Materials',
    },
  });

  const catMetals = await prisma.category.upsert({
    where: { name: 'Metals & Alloys' },
    update: { parentId: catRawMaterials.id },
    create: {
      id: IDS.category.metals,
      name: 'Metals & Alloys',
      parentId: catRawMaterials.id,
    },
  });

  await prisma.category.upsert({
    where: { name: 'Fasteners & Hardware' },
    update: {},
    create: {
      id: IDS.category.fasteners,
      name: 'Fasteners & Hardware',
    },
  });

  console.log(`  ✓ Categories seeded: Raw Materials -> Metals & Alloys, Fasteners & Hardware`);

  // 4. Products (including "Steel Rods" worked example)
  const productSteelRods = await prisma.product.upsert({
    where: { sku: 'STEEL-ROD-001' },
    update: {
      name: 'Steel Rods',
      categoryId: catMetals.id,
      uomId: uomKg.id,
      reorderPoint: 25,
      reorderQty: 100,
    },
    create: {
      id: IDS.product.steelRods,
      sku: 'STEEL-ROD-001',
      name: 'Steel Rods',
      categoryId: catMetals.id,
      uomId: uomKg.id,
      reorderPoint: 25,
      reorderQty: 100,
    },
  });

  await prisma.product.upsert({
    where: { sku: 'BOLT-M12-100' },
    update: {
      name: 'M12 Industrial Bolts (100mm)',
      categoryId: IDS.category.fasteners,
      uomId: uomPcs.id,
      reorderPoint: 50,
      reorderQty: 250,
    },
    create: {
      id: IDS.product.boltsM12,
      sku: 'BOLT-M12-100',
      name: 'M12 Industrial Bolts (100mm)',
      categoryId: IDS.category.fasteners,
      uomId: uomPcs.id,
      reorderPoint: 50,
      reorderQty: 250,
    },
  });

  console.log(`  ✓ Products seeded: ${productSteelRods.name} (${productSteelRods.sku})`);

  // 5. Locations (ERPNext-style self-referencing tree)
  const locMainWarehouse = await prisma.location.upsert({
    where: { id: IDS.location.mainWarehouse },
    update: {
      name: 'Main Warehouse',
      type: LocationType.WAREHOUSE,
    },
    create: {
      id: IDS.location.mainWarehouse,
      name: 'Main Warehouse',
      type: LocationType.WAREHOUSE,
    },
  });

  const locProductionRack = await prisma.location.upsert({
    where: { id: IDS.location.productionRack },
    update: {
      name: 'Production Rack',
      type: LocationType.RACK,
      parentId: locMainWarehouse.id,
    },
    create: {
      id: IDS.location.productionRack,
      name: 'Production Rack',
      type: LocationType.RACK,
      parentId: locMainWarehouse.id,
    },
  });

  await prisma.location.upsert({
    where: { id: IDS.location.receivingBay },
    update: {
      name: 'Receiving Bay A',
      type: LocationType.ZONE,
      parentId: locMainWarehouse.id,
    },
    create: {
      id: IDS.location.receivingBay,
      name: 'Receiving Bay A',
      type: LocationType.ZONE,
      parentId: locMainWarehouse.id,
    },
  });

  console.log(
    `  ✓ Locations seeded: ${locMainWarehouse.name} (WAREHOUSE) -> ${locProductionRack.name} (RACK)`,
  );

  // 6. Documents & Ledger: Reproducing the PDF worked example sequence
  // Step A: Receipt 100kg Steel Rods into Main Warehouse (Status: DONE)
  const existingDoc1 = await prisma.document.findUnique({
    where: { id: IDS.document.doc1Receipt },
  });

  if (!existingDoc1) {
    const doc1 = await prisma.document.create({
      data: {
        id: IDS.document.doc1Receipt,
        type: DocumentType.RECEIPT,
        status: DocumentStatus.DONE,
        destLocationId: locMainWarehouse.id,
        partnerRef: 'PO-2026-STEEL-001',
        createdById: manager.id,
        validatedById: staff.id,
        validatedAt: new Date(Date.now() - 3600 * 1000 * 24 * 3), // 3 days ago
        createdAt: new Date(Date.now() - 3600 * 1000 * 24 * 3),
        lines: {
          create: {
            id: IDS.line.line1,
            productId: productSteelRods.id,
            expectedQty: 100,
            actualQty: 100,
          },
        },
      },
    });

    // Append-only ledger insert
    await prisma.stockLedger.create({
      data: {
        id: IDS.ledger.entry1Receipt,
        productId: productSteelRods.id,
        locationId: locMainWarehouse.id,
        documentId: doc1.id,
        qtyDelta: 100,
        balanceAfter: 100,
        postedAt: doc1.validatedAt!,
        actorId: staff.id,
      },
    });

    console.log('  ✓ Step 1: Receipt document validated (+100kg into Main Warehouse)');
  }

  // Step B: Internal Transfer 30kg from Main Warehouse to Production Rack (Status: DONE)
  // Non-negotiable domain rule: Dual ledger entry netting zero across system
  const existingDoc2 = await prisma.document.findUnique({
    where: { id: IDS.document.doc2Transfer },
  });

  if (!existingDoc2) {
    const doc2 = await prisma.document.create({
      data: {
        id: IDS.document.doc2Transfer,
        type: DocumentType.TRANSFER,
        status: DocumentStatus.DONE,
        sourceLocationId: locMainWarehouse.id,
        destLocationId: locProductionRack.id,
        partnerRef: 'INT-TRANS-001',
        createdById: staff.id,
        validatedById: staff.id,
        validatedAt: new Date(Date.now() - 3600 * 1000 * 24 * 2), // 2 days ago
        createdAt: new Date(Date.now() - 3600 * 1000 * 24 * 2),
        lines: {
          create: {
            id: IDS.line.line2,
            productId: productSteelRods.id,
            expectedQty: 30,
            actualQty: 30,
          },
        },
      },
    });

    // Dual ledger entries (source -30kg, dest +30kg)
    await prisma.stockLedger.create({
      data: {
        id: IDS.ledger.entry2TransferOut,
        productId: productSteelRods.id,
        locationId: locMainWarehouse.id,
        documentId: doc2.id,
        qtyDelta: -30,
        balanceAfter: 70, // 100 - 30
        postedAt: doc2.validatedAt!,
        actorId: staff.id,
      },
    });

    await prisma.stockLedger.create({
      data: {
        id: IDS.ledger.entry3TransferIn,
        productId: productSteelRods.id,
        locationId: locProductionRack.id,
        documentId: doc2.id,
        qtyDelta: 30,
        balanceAfter: 30, // 0 + 30
        postedAt: doc2.validatedAt!,
        actorId: staff.id,
      },
    });

    console.log(
      '  ✓ Step 2: Internal Transfer validated (-30kg Main Warehouse, +30kg Production Rack)',
    );
  }

  // Step C: Delivery Order 20kg shipped from Main Warehouse (Status: DONE)
  const existingDoc3 = await prisma.document.findUnique({
    where: { id: IDS.document.doc3Delivery },
  });

  if (!existingDoc3) {
    const doc3 = await prisma.document.create({
      data: {
        id: IDS.document.doc3Delivery,
        type: DocumentType.DELIVERY,
        status: DocumentStatus.DONE,
        sourceLocationId: locMainWarehouse.id,
        partnerRef: 'SO-2026-CUST-88',
        createdById: manager.id,
        validatedById: staff.id,
        validatedAt: new Date(Date.now() - 3600 * 1000 * 24 * 1), // 1 day ago
        createdAt: new Date(Date.now() - 3600 * 1000 * 24 * 1),
        lines: {
          create: {
            id: IDS.line.line3,
            productId: productSteelRods.id,
            expectedQty: 20,
            actualQty: 20,
          },
        },
      },
    });

    await prisma.stockLedger.create({
      data: {
        id: IDS.ledger.entry4DeliveryOut,
        productId: productSteelRods.id,
        locationId: locMainWarehouse.id,
        documentId: doc3.id,
        qtyDelta: -20,
        balanceAfter: 50, // 70 - 20
        postedAt: doc3.validatedAt!,
        actorId: staff.id,
      },
    });

    console.log('  ✓ Step 3: Delivery validated (-20kg from Main Warehouse)');
  }

  // Step D: Stock Adjustment: -3kg damaged at Main Warehouse (Status: DONE)
  const existingDoc4 = await prisma.document.findUnique({
    where: { id: IDS.document.doc4Adjustment },
  });

  if (!existingDoc4) {
    const doc4 = await prisma.document.create({
      data: {
        id: IDS.document.doc4Adjustment,
        type: DocumentType.ADJUSTMENT,
        status: DocumentStatus.DONE,
        sourceLocationId: locMainWarehouse.id,
        partnerRef: 'ADJ-COUNT-DAMAGED-3KG',
        createdById: manager.id,
        validatedById: manager.id,
        validatedAt: new Date(Date.now() - 3600 * 1000 * 12), // 12 hours ago
        createdAt: new Date(Date.now() - 3600 * 1000 * 12),
        lines: {
          create: {
            id: IDS.line.line4,
            productId: productSteelRods.id,
            expectedQty: 50,
            actualQty: 47, // delta = -3kg
          },
        },
      },
    });

    await prisma.stockLedger.create({
      data: {
        id: IDS.ledger.entry5AdjustmentDelta,
        productId: productSteelRods.id,
        locationId: locMainWarehouse.id,
        documentId: doc4.id,
        qtyDelta: -3,
        balanceAfter: 47, // 50 - 3
        postedAt: doc4.validatedAt!,
        actorId: manager.id,
      },
    });

    console.log('  ✓ Step 4: Adjustment validated (-3kg delta at Main Warehouse)');
  }

  // Step E: Pending document in WAITING state for active dashboard display
  await prisma.document.upsert({
    where: { id: IDS.document.doc5PendingReceipt },
    update: {
      status: DocumentStatus.WAITING,
    },
    create: {
      id: IDS.document.doc5PendingReceipt,
      type: DocumentType.RECEIPT,
      status: DocumentStatus.WAITING,
      destLocationId: locMainWarehouse.id,
      partnerRef: 'PO-2026-INCOMING-50KG',
      createdById: manager.id,
      createdAt: new Date(),
      lines: {
        create: {
          id: IDS.line.line5,
          productId: productSteelRods.id,
          expectedQty: 50,
        },
      },
    },
  });

  console.log('  ✓ Step 5: Pending Receipt document created (status: WAITING, 50kg expected)');

  // 7. Synchronize stock_balances (derived read-model cache)
  // Final state: Main Warehouse = 47kg, Production Rack = 30kg
  await prisma.stockBalance.upsert({
    where: {
      productId_locationId: {
        productId: productSteelRods.id,
        locationId: locMainWarehouse.id,
      },
    },
    update: {
      quantity: 47,
    },
    create: {
      productId: productSteelRods.id,
      locationId: locMainWarehouse.id,
      quantity: 47,
    },
  });

  await prisma.stockBalance.upsert({
    where: {
      productId_locationId: {
        productId: productSteelRods.id,
        locationId: locProductionRack.id,
      },
    },
    update: {
      quantity: 30,
    },
    create: {
      productId: productSteelRods.id,
      locationId: locProductionRack.id,
      quantity: 30,
    },
  });

  console.log('  ✓ Stock balances synchronized (Main Warehouse: 47kg, Production Rack: 30kg)');

  console.log('\n🎉 StockSense demo dataset successfully seeded! Ready for development.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
