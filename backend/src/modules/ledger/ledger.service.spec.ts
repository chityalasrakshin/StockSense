import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('LedgerService', () => {
  let service: LedgerService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      stockBalance: {
        findUnique: jest.fn(),
      },
      stockLedger: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockResolvedValue([{ quantity: 50 }]),
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

  describe('append (Single Choke Point with SELECT ... FOR UPDATE)', () => {
    it('locks balance row, updates stock balance and creates ledger entry', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ quantity: 50 }]);
      const mockLedger = {
        id: 'entry-1',
        productId: 'prod-1',
        locationId: 'loc-1',
        qtyDelta: 30,
        balanceAfter: 80,
        actorId: 'user-1',
        postedAt: new Date(),
      };
      prisma.stockLedger.create.mockResolvedValue(mockLedger);

      const result = await service.append({
        productId: 'prod-1',
        locationId: 'loc-1',
        qtyDelta: 30,
        actorId: 'user-1',
      });

      expect(prisma.$executeRaw).toHaveBeenCalledTimes(2); // insert on conflict, then update
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1); // SELECT ... FOR UPDATE
      expect(prisma.stockLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 'prod-1',
            locationId: 'loc-1',
            qtyDelta: 30,
            balanceAfter: 80,
            actorId: 'user-1',
          }),
        }),
      );
      expect(result).toEqual(mockLedger);
    });

    it('throws clean 409 ConflictException if reduction takes stock balance negative', async () => {
      prisma.$queryRaw.mockResolvedValue([{ quantity: 10 }]);

      await expect(
        service.append({
          productId: 'prod-1',
          locationId: 'loc-1',
          qtyDelta: -25,
          actorId: 'user-1',
          allowNegative: false,
        }),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.append({
          productId: 'prod-1',
          locationId: 'loc-1',
          qtyDelta: -25,
          actorId: 'user-1',
          allowNegative: false,
        }),
      ).rejects.toThrow(/Insufficient stock/);
    });
  });

  describe('recordInitialStock', () => {
    it('delegates to append and returns created ledger and balance', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ quantity: 0 }]);
      const mockLedger = {
        id: 'entry-init',
        productId: 'prod-1',
        locationId: 'loc-1',
        qtyDelta: 100,
        balanceAfter: 100,
        actorId: 'user-1',
        postedAt: new Date(),
      };
      prisma.stockLedger.create.mockResolvedValue(mockLedger);
      prisma.stockBalance.findUnique.mockResolvedValue({
        productId: 'prod-1',
        locationId: 'loc-1',
        quantity: 100,
      });

      const res = await service.recordInitialStock({
        productId: 'prod-1',
        locationId: 'loc-1',
        quantity: 100,
        actorId: 'user-1',
      });

      expect(res.ledgerEntry).toEqual(mockLedger);
      expect(res.balance.quantity).toBe(100);
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

  describe('findMoveHistory', () => {
    it('returns paginated ledger audit trail', async () => {
      prisma.stockLedger.findMany.mockResolvedValue([
        {
          id: 'l1',
          productId: 'p1',
          locationId: 'loc1',
          qtyDelta: 50,
          balanceAfter: 50,
          postedAt: new Date(),
        },
      ]);
      prisma.stockLedger.count.mockResolvedValue(1);

      const res = await service.findMoveHistory({ page: 1, limit: 10 });
      expect(res.items.length).toBe(1);
      expect(res.meta.totalItems).toBe(1);
      expect(prisma.stockLedger.findMany).toHaveBeenCalled();
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
