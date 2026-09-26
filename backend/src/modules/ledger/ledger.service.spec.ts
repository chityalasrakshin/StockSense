import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('LedgerService', () => {
  let service: LedgerService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      stockBalance: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
      },
      stockLedger: {
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<LedgerService>(LedgerService);
  });

  describe('recordInitialStock', () => {
    it('creates exactly one stock_balances row and one stock_ledger entry', async () => {
      const mockBalance = {
        productId: 'prod-1',
        locationId: 'loc-1',
        quantity: 100,
        updatedAt: new Date(),
      };

      const mockLedgerEntry = {
        id: 'ledger-entry-1',
        productId: 'prod-1',
        locationId: 'loc-1',
        documentId: null,
        qtyDelta: 100,
        balanceAfter: 100,
        actorId: 'user-1',
        postedAt: new Date(),
      };

      prisma.stockBalance.upsert.mockResolvedValue(mockBalance);
      prisma.stockLedger.create.mockResolvedValue(mockLedgerEntry);

      const result = await service.recordInitialStock({
        productId: 'prod-1',
        locationId: 'loc-1',
        quantity: 100,
        actorId: 'user-1',
      });

      expect(prisma.stockBalance.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.stockBalance.upsert).toHaveBeenCalledWith({
        where: {
          productId_locationId: {
            productId: 'prod-1',
            locationId: 'loc-1',
          },
        },
        update: {
          quantity: { increment: 100 },
        },
        create: {
          productId: 'prod-1',
          locationId: 'loc-1',
          quantity: 100,
        },
      });

      expect(prisma.stockLedger.create).toHaveBeenCalledTimes(1);
      expect(prisma.stockLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 'prod-1',
            locationId: 'loc-1',
            qtyDelta: 100,
            balanceAfter: 100,
            actorId: 'user-1',
            documentId: null,
          }),
        }),
      );

      expect(result.ledgerEntry).toEqual(mockLedgerEntry);
      expect(result.balance).toEqual(mockBalance);
    });

    it('rejects negative initial stock with BadRequestException', async () => {
      await expect(
        service.recordInitialStock({
          productId: 'prod-1',
          locationId: 'loc-1',
          quantity: -10,
          actorId: 'user-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('append', () => {
    it('appends ledger entry and updates balance atomically', async () => {
      prisma.stockBalance.findUnique.mockResolvedValue({ quantity: 50 });
      prisma.stockBalance.upsert.mockResolvedValue({ quantity: 80 });
      prisma.stockLedger.create.mockResolvedValue({ id: 'l2', qtyDelta: 30, balanceAfter: 80 });

      const entry = await service.append({
        productId: 'prod-1',
        locationId: 'loc-1',
        qtyDelta: 30,
        actorId: 'user-1',
      });

      expect(prisma.stockBalance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { quantity: 80 },
        }),
      );
      expect(entry.balanceAfter).toBe(80);
    });

    it('throws BadRequestException if negative delta causes negative stock balance', async () => {
      prisma.stockBalance.findUnique.mockResolvedValue({ quantity: 10 });

      await expect(
        service.append({
          productId: 'prod-1',
          locationId: 'loc-1',
          qtyDelta: -20,
          actorId: 'user-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getBalance', () => {
    it('returns balance quantity or 0 if record does not exist', async () => {
      prisma.stockBalance.findUnique.mockResolvedValueOnce({ quantity: 47 });
      const b1 = await service.getBalance('p1', 'l1');
      expect(b1).toBe(47);

      prisma.stockBalance.findUnique.mockResolvedValueOnce(null);
      const b2 = await service.getBalance('p2', 'l2');
      expect(b2).toBe(0);
    });
  });
});
