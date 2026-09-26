import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { UomsService } from './uoms.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('UomsService', () => {
  let service: UomsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      unitOfMeasure: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      product: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UomsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UomsService>(UomsService);
  });

  describe('create', () => {
    it('creates a new unit of measure', async () => {
      prisma.unitOfMeasure.findUnique.mockResolvedValue(null);
      prisma.unitOfMeasure.create.mockResolvedValue({
        id: 'uom-1',
        code: 'kg',
        name: 'Kilograms',
      });

      const result = await service.create({ code: 'kg', name: 'Kilograms' });
      expect(result.id).toBe('uom-1');
      expect(prisma.unitOfMeasure.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { code: 'kg', name: 'Kilograms' },
        }),
      );
    });

    it('throws ConflictException on duplicate UoM code', async () => {
      prisma.unitOfMeasure.findUnique.mockResolvedValue({ id: 'uom-1', code: 'kg' });

      await expect(service.create({ code: 'kg', name: 'Kilograms' })).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create({ code: 'kg', name: 'Kilograms' })).rejects.toThrow(
        /already exists/,
      );
    });
  });

  describe('remove', () => {
    it('blocks UoM deletion with 409 ConflictException when products reference it', async () => {
      prisma.unitOfMeasure.findUnique.mockResolvedValue({ id: 'uom-1', code: 'kg' });
      prisma.product.count.mockResolvedValue(5);

      await expect(service.remove('uom-1')).rejects.toThrow(ConflictException);
      await expect(service.remove('uom-1')).rejects.toThrow(/assigned to 5 product\(s\)/);
      expect(prisma.unitOfMeasure.delete).not.toHaveBeenCalled();
    });

    it('deletes UoM when no products reference it', async () => {
      prisma.unitOfMeasure.findUnique.mockResolvedValue({ id: 'uom-1', code: 'kg' });
      prisma.product.count.mockResolvedValue(0);
      prisma.unitOfMeasure.delete.mockResolvedValue({ id: 'uom-1' });

      const res = await service.remove('uom-1');
      expect(res.id).toBe('uom-1');
      expect(prisma.unitOfMeasure.delete).toHaveBeenCalledWith({ where: { id: 'uom-1' } });
    });
  });
});
