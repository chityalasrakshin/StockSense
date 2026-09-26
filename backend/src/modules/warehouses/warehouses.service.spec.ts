import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LocationType } from '@prisma/client';

describe('WarehousesService', () => {
  let service: WarehousesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      location: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      stockBalance: {
        count: jest.fn(),
        deleteMany: jest.fn(),
      },
      document: {
        count: jest.fn(),
      },
      stockLedger: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehousesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<WarehousesService>(WarehousesService);
  });

  describe('create', () => {
    it('creates a new warehouse location', async () => {
      prisma.location.findUnique.mockResolvedValue(null);
      prisma.location.create.mockResolvedValue({
        id: 'loc-1',
        name: 'Main Warehouse',
        shortCode: 'WH',
        type: LocationType.WAREHOUSE,
        parentId: null,
      });

      const res = await service.create({
        name: 'Main Warehouse',
        shortCode: 'wh',
        type: LocationType.WAREHOUSE,
      });

      expect(res.id).toBe('loc-1');
      expect(prisma.location.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            name: 'Main Warehouse',
            shortCode: 'WH',
            type: LocationType.WAREHOUSE,
            parentId: null,
          },
        }),
      );
    });

    it('throws ConflictException on duplicate shortCode', async () => {
      prisma.location.findUnique.mockResolvedValue({ id: 'loc-1', shortCode: 'WH' });

      await expect(
        service.create({
          name: 'Another Warehouse',
          shortCode: 'WH',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getTree', () => {
    it('builds recursive warehouse hierarchy tree (ERPNext model)', async () => {
      const mockLocations = [
        { id: 'w1', name: 'Main WH', shortCode: 'WH', type: LocationType.WAREHOUSE, parentId: null },
        { id: 'z1', name: 'Zone A', shortCode: 'WH-ZA', type: LocationType.ZONE, parentId: 'w1' },
        { id: 'r1', name: 'Rack 1', shortCode: 'WH-ZA-R1', type: LocationType.RACK, parentId: 'z1' },
      ];
      prisma.location.findMany.mockResolvedValue(mockLocations);

      const tree = await service.getTree();
      expect(tree.length).toBe(1);
      expect(tree[0].id).toBe('w1');
      expect(tree[0].children[0].id).toBe('z1');
      expect(tree[0].children[0].children[0].id).toBe('r1');
    });
  });

  describe('remove', () => {
    it('blocks deletion if child locations exist', async () => {
      prisma.location.findUnique.mockResolvedValue({ id: 'w1', shortCode: 'WH' });
      prisma.location.count.mockResolvedValue(2); // 2 children

      await expect(service.remove('w1')).rejects.toThrow(ConflictException);
      await expect(service.remove('w1')).rejects.toThrow(/child sub-location/);
    });

    it('blocks deletion if active positive stock exists at location', async () => {
      prisma.location.findUnique.mockResolvedValue({ id: 'w1', shortCode: 'WH' });
      prisma.location.count.mockResolvedValue(0);
      prisma.stockBalance.count.mockResolvedValue(1); // active stock

      await expect(service.remove('w1')).rejects.toThrow(ConflictException);
      await expect(service.remove('w1')).rejects.toThrow(/positive stock balances exist/);
    });

    it('blocks deletion if referenced in documents', async () => {
      prisma.location.findUnique.mockResolvedValue({ id: 'w1', shortCode: 'WH' });
      prisma.location.count.mockResolvedValue(0);
      prisma.stockBalance.count.mockResolvedValue(0);
      prisma.document.count.mockResolvedValue(3); // 3 docs

      await expect(service.remove('w1')).rejects.toThrow(ConflictException);
      await expect(service.remove('w1')).rejects.toThrow(/referenced by 3 workflow document/);
    });

    it('blocks deletion if historical stock ledger entries exist', async () => {
      prisma.location.findUnique.mockResolvedValue({ id: 'w1', shortCode: 'WH' });
      prisma.location.count.mockResolvedValue(0);
      prisma.stockBalance.count.mockResolvedValue(0);
      prisma.document.count.mockResolvedValue(0);
      prisma.stockLedger.count.mockResolvedValue(5); // 5 ledger rows

      await expect(service.remove('w1')).rejects.toThrow(ConflictException);
      await expect(service.remove('w1')).rejects.toThrow(/audit ledger records exist/);
    });

    it('safely deletes location when unreferenced and empty', async () => {
      prisma.location.findUnique.mockResolvedValue({ id: 'w1', shortCode: 'WH' });
      prisma.location.count.mockResolvedValue(0);
      prisma.stockBalance.count.mockResolvedValue(0);
      prisma.document.count.mockResolvedValue(0);
      prisma.stockLedger.count.mockResolvedValue(0);
      prisma.stockBalance.deleteMany.mockResolvedValue({ count: 0 });
      prisma.location.delete.mockResolvedValue({ id: 'w1' });

      const res = await service.remove('w1');
      expect(res.id).toBe('w1');
      expect(prisma.location.delete).toHaveBeenCalledWith({ where: { id: 'w1' } });
    });
  });
});
