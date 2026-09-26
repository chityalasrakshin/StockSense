import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { Prisma } from '@prisma/client';

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: any;
  let ledgerService: any;

  beforeEach(async () => {
    prisma = {
      product: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      category: {
        findUnique: jest.fn(),
      },
      unitOfMeasure: {
        findUnique: jest.fn(),
      },
      location: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      stockBalance: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      stockLedger: {
        count: jest.fn(),
      },
      documentLine: {
        count: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
      $queryRaw: jest.fn(),
    };

    ledgerService = {
      recordInitialStock: jest.fn().mockResolvedValue({
        ledgerEntry: { id: 'l1', qtyDelta: 50 },
        balance: { quantity: 50 },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prisma },
        { provide: LedgerService, useValue: ledgerService },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('create', () => {
    it('creates product without initial stock', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue({
        id: 'prod-1',
        sku: 'DESK-002',
        name: 'Standing Desk',
        unitCost: new Prisma.Decimal(250),
        reorderPoint: 5,
        reorderQty: 20,
        balances: [],
      });

      const res = await service.create(
        {
          sku: 'DESK-002',
          name: 'Standing Desk',
          unitCost: 250,
        },
        'user-1',
      );

      expect(res.id).toBe('prod-1');
      expect(res.totalStock).toBe(0);
      expect(ledgerService.recordInitialStock).not.toHaveBeenCalled();
    });

    it('creates product with initial stock: calls ledgerService.recordInitialStock inside transaction', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      prisma.location.findUnique.mockResolvedValue({ id: 'loc-wh-1' });
      prisma.product.create.mockResolvedValue({
        id: 'prod-steel-1',
        sku: 'STEEL-001',
        name: 'Steel Rods',
        unitCost: new Prisma.Decimal(45),
        reorderPoint: 25,
        reorderQty: 100,
      });
      prisma.stockBalance.findMany.mockResolvedValue([
        { productId: 'prod-steel-1', locationId: 'loc-wh-1', quantity: 100 },
      ]);

      const res = await service.create(
        {
          sku: 'STEEL-001',
          name: 'Steel Rods',
          initialStock: 100,
          initialLocationId: 'loc-wh-1',
        },
        'manager-user-1',
      );

      expect(res.id).toBe('prod-steel-1');
      expect(ledgerService.recordInitialStock).toHaveBeenCalledTimes(1);
      expect(ledgerService.recordInitialStock).toHaveBeenCalledWith(
        {
          productId: 'prod-steel-1',
          locationId: 'loc-wh-1',
          quantity: 100,
          actorId: 'manager-user-1',
        },
        prisma,
      );
      expect(res.totalStock).toBe(100);
    });

    it('throws clean 409 ConflictException when SKU already exists', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'p-existing',
        sku: 'STEEL-001',
      });

      await expect(
        service.create({ sku: 'STEEL-001', name: 'Duplicate SKU' }, 'user-1'),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.create({ sku: 'STEEL-001', name: 'Duplicate SKU' }, 'user-1'),
      ).rejects.toThrow(/Product with SKU "STEEL-001" already exists/);
    });
  });

  describe('search (pg_trgm fuzzy matching)', () => {
    it('executes parameterized pg_trgm query and returns mapped search results', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'p1',
          sku: 'STEEL-ROD-001',
          name: 'Steel Rods',
          unitCost: new Prisma.Decimal(45),
          categoryName: 'Metals',
          uomName: 'Kilograms',
          uomCode: 'kg',
          totalStock: 77,
          reorderPoint: 25,
          reorderQty: 100,
          similarityScore: 0.54,
        },
      ]);

      const results = await service.search('steel');
      expect(results.length).toBe(1);
      expect(results[0].sku).toBe('STEEL-ROD-001');
      expect(results[0].similarityScore).toBe(0.54);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('returns empty array if search query is blank', async () => {
      const results = await service.search('');
      expect(results).toEqual([]);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('blocks product deletion if stock ledger history exists', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        sku: 'STEEL-ROD-001',
        name: 'Steel Rods',
        balances: [],
      });
      prisma.stockLedger.count.mockResolvedValue(4);

      await expect(service.remove('p1')).rejects.toThrow(ConflictException);
      await expect(service.remove('p1')).rejects.toThrow(/stock ledger audit entry/);
    });

    it('blocks product deletion if document lines reference it', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        sku: 'STEEL-ROD-001',
        name: 'Steel Rods',
        balances: [],
      });
      prisma.stockLedger.count.mockResolvedValue(0);
      prisma.documentLine.count.mockResolvedValue(2);

      await expect(service.remove('p1')).rejects.toThrow(ConflictException);
      await expect(service.remove('p1')).rejects.toThrow(/referenced in 2 document line/);
    });
  });
});
