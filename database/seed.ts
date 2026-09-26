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
    furniture: 'c0000000-0000-0000-0000-000000000004',
  },
  uom: {
    kg: 'u0000000-0000-0000-0000-000000000001',
    pcs: 'u0000000-0000-0000-0000-000000000002',
    box: 'u0000000-0000-0000-0000-000000000003',
  },
  product: {
    steelRods: 'p0000000-0000-0000-0000-000000000001',
    boltsM12: 'p0000000-0000-0000-0000-000000000002',
    officeDesk: 'p0000000-0000-0000-0000-000000000003',
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
const DEMO_PASSWORD_HASH = '$2b$10$bVlK.vJZIcJIWGH0JQ.52./8KxmbJSvcsIyPbqqZO62JxlLlGr60i';

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

  const catFasteners = await prisma.category.upsert({
    where: { name: 'Fasteners & Hardware' },
    update: {},
    create: {
      id: IDS.category.fasteners,
      name: 'Fasteners & Hardware',
    },
  });

  const catFurniture = await prisma.category.upsert({
    where: { name: 'Office Furniture' },
    update: {},
    create: {
      id: IDS.category.furniture,
      name: 'Office Furniture',
    },
  });

  console.log(
    `  ✓ Categories seeded: Raw Materials -> Metals & Alloys, Fasteners & Hardware, Office Furniture`,
  );

  // 4. Products (including "Steel Rods" worked example and "Desk" from UX mockup)
  const productSteelRods = await prisma.product.upsert({
    where: { sku: 'STEEL-ROD-001' },
    update: {
      name: 'Steel Rods',
      unitCost: 45.0,
      categoryId: catMetals.id,
      uomId: uomKg.id,
      reorderPoint: 25,
      reorderQty: 100,
    },
    create: {
      id: IDS.product.steelRods,
      sku: 'STEEL-ROD-001',
      name: 'Steel Rods',
      unitCost: 45.0,
      categoryId: catMetals.id,
      uomId: uomKg.id,
      reorderPoint: 25,
      reorderQty: 100,
    },
  });

  const productBoltsM12 = await prisma.product.upsert({
    where: { sku: 'BOLT-M12-100' },
    update: {
      name: 'M12 Industrial Bolts (100mm)',
      unitCost: 1.25,
      categoryId: catFasteners.id,
      uomId: uomPcs.id,
      reorderPoint: 50,
      reorderQty: 250,
    },
    create: {
      id: IDS.product.boltsM12,
      sku: 'BOLT-M12-100',
      name: 'M12 Industrial Bolts (100mm)',
      unitCost: 1.25,
      categoryId: catFasteners.id,
      uomId: uomPcs.id,
      reorderPoint: 50,
      reorderQty: 250,
    },
  });

  const productOfficeDesk = await prisma.product.upsert({
    where: { sku: 'DESK-001' },
    update: {
      name: 'Office Desk',
      unitCost: 3000.0,
      categoryId: catFurniture.id,
      uomId: uomPcs.id,
      reorderPoint: 10,
      reorderQty: 20,
    },
    create: {
      id: IDS.product.officeDesk,
      sku: 'DESK-001',
      name: 'Office Desk',
      unitCost: 3000.0,
      categoryId: catFurniture.id,
      uomId: uomPcs.id,
      reorderPoint: 10,
      reorderQty: 20,
    },
  });

  console.log(
    `  ✓ Products seeded: ${productSteelRods.name} (SKU: ${productSteelRods.sku}, Unit Cost: $${productSteelRods.unitCost})`,
  );

  // 5. Locations (ERPNext-style self-referencing tree with unique short codes)
  const locMainWarehouse = await prisma.location.upsert({
    where: { id: IDS.location.mainWarehouse },
    update: {
      name: 'Main Warehouse',
      shortCode: 'WH',
      type: LocationType.WAREHOUSE,
    },
    create: {
      id: IDS.location.mainWarehouse,
      name: 'Main Warehouse',
      shortCode: 'WH',
      type: LocationType.WAREHOUSE,
    },
  });

  const locProductionRack = await prisma.location.upsert({
    where: { id: IDS.location.productionRack },
    update: {
      name: 'Production Rack',
      shortCode: 'WH-PR',
      type: LocationType.RACK,
      parentId: locMainWarehouse.id,
    },
    create: {
      id: IDS.location.productionRack,
      name: 'Production Rack',
      shortCode: 'WH-PR',
      type: LocationType.RACK,
      parentId: locMainWarehouse.id,
    },
  });

  await prisma.location.upsert({
    where: { id: IDS.location.receivingBay },
    update: {
      name: 'Receiving Bay A',
      shortCode: 'WH-REC',
      type: LocationType.ZONE,
      parentId: locMainWarehouse.id,
    },
    create: {
      id: IDS.location.receivingBay,
      name: 'Receiving Bay A',
      shortCode: 'WH-REC',
      type: LocationType.ZONE,
      parentId: locMainWarehouse.id,
    },
  });

  console.log(
    `  ✓ Locations seeded: ${locMainWarehouse.name} [${locMainWarehouse.shortCode}] -> ${locProductionRack.name} [${locProductionRack.shortCode}]`,
  );

  // 6. Documents & Ledger: Reproducing the PDF worked example sequence
  // Operation prefix formatting rule: <warehouse.short_code>/<IN or OUT>/<sequence>
  // - RECEIPT: IN
  // - DELIVERY: OUT
  // - TRANSFER: OUT (dispatched from source warehouse)
  // - ADJUSTMENT: OUT (for decrement / scrap / loss)

  // Step A: Receipt 100kg Steel Rods into Main Warehouse (Status: DONE)
  const existingDoc1 = await prisma.document.findUnique({
    where: { id: IDS.document.doc1Receipt },
  });

  if (!existingDoc1) {
    const doc1 = await prisma.document.create({
      data: {
        id: IDS.document.doc1Receipt,
        reference: 'WH/IN/00001',
        type: DocumentType.RECEIPT,
        status: DocumentStatus.DONE,
        destLocationId: locMainWarehouse.id,
        contact: 'Vandertramp Steels Ltd.',
        partnerRef: 'PO-2026-STEEL-001',
        scheduleDate: new Date(Date.now() - 3600 * 1000 * 24 * 3),
        createdById: manager.id,
        responsibleUserId: staff.id,
        validatedById: staff.id,
        validatedAt: new Date(Date.now() - 3600 * 1000 * 24 * 3),
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

    console.log(
      `  ✓ Step 1: Receipt validated [${doc1.reference}] (+100kg into Main Warehouse from ${doc1.contact})`,
    );
  }

  // Step B: Internal Transfer 30kg from Main Warehouse to Production Rack (Status: DONE)
  const existingDoc2 = await prisma.document.findUnique({
    where: { id: IDS.document.doc2Transfer },
  });

  if (!existingDoc2) {
    const doc2 = await prisma.document.create({
      data: {
        id: IDS.document.doc2Transfer,
        reference: 'WH/OUT/00001',
        type: DocumentType.TRANSFER,
        status: DocumentStatus.DONE,
        sourceLocationId: locMainWarehouse.id,
        destLocationId: locProductionRack.id,
        contact: 'Internal Assembly Team',
        partnerRef: 'INT-TRANS-001',
        scheduleDate: new Date(Date.now() - 3600 * 1000 * 24 * 2),
        createdById: staff.id,
        responsibleUserId: staff.id,
        validatedById: staff.id,
        validatedAt: new Date(Date.now() - 3600 * 1000 * 24 * 2),
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
      `  ✓ Step 2: Transfer validated [${doc2.reference}] (-30kg Main Warehouse, +30kg Production Rack)`,
    );
  }

  // Step C: Delivery Order 20kg shipped from Main Warehouse to Azure Interior (Status: DONE)
  const existingDoc3 = await prisma.document.findUnique({
    where: { id: IDS.document.doc3Delivery },
  });

  if (!existingDoc3) {
    const doc3 = await prisma.document.create({
      data: {
        id: IDS.document.doc3Delivery,
        reference: 'WH/OUT/00002',
        type: DocumentType.DELIVERY,
        status: DocumentStatus.DONE,
        sourceLocationId: locMainWarehouse.id,
        contact: 'Azure Interior', // Matching UX Mockup
        partnerRef: 'SO-2026-AZURE-88',
        scheduleDate: new Date(Date.now() - 3600 * 1000 * 24 * 1),
        createdById: manager.id,
        responsibleUserId: staff.id,
        validatedById: staff.id,
        validatedAt: new Date(Date.now() - 3600 * 1000 * 24 * 1),
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

    console.log(
      `  ✓ Step 3: Delivery validated [${doc3.reference}] (-20kg from Main Warehouse to ${doc3.contact})`,
    );
  }

  // Step D: Stock Adjustment: -3kg damaged at Main Warehouse (Status: DONE)
  const existingDoc4 = await prisma.document.findUnique({
    where: { id: IDS.document.doc4Adjustment },
  });

  if (!existingDoc4) {
    const doc4 = await prisma.document.create({
      data: {
        id: IDS.document.doc4Adjustment,
        reference: 'WH/OUT/00003',
        type: DocumentType.ADJUSTMENT,
        status: DocumentStatus.DONE,
        sourceLocationId: locMainWarehouse.id,
        contact: 'Quality Control / Scrap',
        partnerRef: 'ADJ-COUNT-DAMAGED-3KG',
        scheduleDate: new Date(Date.now() - 3600 * 1000 * 12),
        createdById: manager.id,
        responsibleUserId: manager.id,
        validatedById: manager.id,
        validatedAt: new Date(Date.now() - 3600 * 1000 * 12),
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

    console.log(
      `  ✓ Step 4: Adjustment validated [${doc4.reference}] (-3kg delta at Main Warehouse)`,
    );
  }

  // Step E: Pending document in WAITING state for active dashboard display
  await prisma.document.upsert({
    where: { id: IDS.document.doc5PendingReceipt },
    update: {
      reference: 'WH/IN/00002',
      status: DocumentStatus.WAITING,
      contact: 'Apex Metal Suppliers',
      scheduleDate: new Date(Date.now() + 3600 * 1000 * 24 * 1),
      responsibleUserId: manager.id,
    },
    create: {
      id: IDS.document.doc5PendingReceipt,
      reference: 'WH/IN/00002',
      type: DocumentType.RECEIPT,
      status: DocumentStatus.WAITING,
      destLocationId: locMainWarehouse.id,
      contact: 'Apex Metal Suppliers',
      partnerRef: 'PO-2026-INCOMING-50KG',
      scheduleDate: new Date(Date.now() + 3600 * 1000 * 24 * 1),
      createdById: manager.id,
      responsibleUserId: manager.id,
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

  console.log(
    '  ✓ Step 5: Pending Receipt created [WH/IN/00002] (status: WAITING, 50kg expected from Apex Metal)',
  );

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

  // 8. Low Stock Alerts (Bolts and Desks have 0 stock <= reorder point)
  await prisma.lowStockAlert.upsert({
    where: {
      productId_locationId: {
        productId: productBoltsM12.id,
        locationId: locMainWarehouse.id,
      },
    },
    update: {
      currentStock: 0,
      reorderPoint: productBoltsM12.reorderPoint,
      status: 'OPEN',
    },
    create: {
      productId: productBoltsM12.id,
      locationId: locMainWarehouse.id,
      currentStock: 0,
      reorderPoint: productBoltsM12.reorderPoint,
      status: 'OPEN',
    },
  });

  await prisma.lowStockAlert.upsert({
    where: {
      productId_locationId: {
        productId: productOfficeDesk.id,
        locationId: locMainWarehouse.id,
      },
    },
    update: {
      currentStock: 0,
      reorderPoint: productOfficeDesk.reorderPoint,
      status: 'OPEN',
    },
    create: {
      productId: productOfficeDesk.id,
      locationId: locMainWarehouse.id,
      currentStock: 0,
      reorderPoint: productOfficeDesk.reorderPoint,
      status: 'OPEN',
    },
  });

  console.log('  ✓ Low stock alerts initialized (M12 Bolts: OPEN, Office Desk: OPEN)');

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
