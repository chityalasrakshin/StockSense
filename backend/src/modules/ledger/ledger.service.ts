import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma, StockLedger, StockBalance } from '@prisma/client';

export interface AppendLedgerEntryDto {
  productId: string;
  locationId: string;
  documentId?: string | null;
  qtyDelta: number;
  balanceAfter?: number;
  actorId: string;
  postedAt?: Date;
}

export interface RecordInitialStockDto {
  productId: string;
  locationId: string;
  quantity: number;
  actorId: string;
}

export interface ILedgerService {
  recordInitialStock(
    dto: RecordInitialStockDto,
    txClient?: Prisma.TransactionClient,
  ): Promise<{ ledgerEntry: StockLedger; balance: StockBalance }>;

  append(
    entry: AppendLedgerEntryDto,
    txClient?: Prisma.TransactionClient,
  ): Promise<StockLedger>;

  getBalance(
    productId: string,
    locationId: string,
    txClient?: Prisma.TransactionClient,
  ): Promise<number>;
}

@Injectable()
export class LedgerService implements ILedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records the initial stock entry for a newly created product onboarding into a warehouse.
   * Creates exactly one row in stock_ledger and updates/creates the corresponding stock_balances row.
   */
  async recordInitialStock(
    dto: RecordInitialStockDto,
    txClient?: Prisma.TransactionClient,
  ): Promise<{ ledgerEntry: StockLedger; balance: StockBalance }> {
    const client = txClient || this.prisma;

    if (dto.quantity < 0) {
      throw new BadRequestException('Initial stock quantity cannot be negative');
    }

    // 1. Upsert stock_balances row
    const balance = await client.stockBalance.upsert({
      where: {
        productId_locationId: {
          productId: dto.productId,
          locationId: dto.locationId,
        },
      },
      update: {
        quantity: {
          increment: dto.quantity,
        },
      },
      create: {
        productId: dto.productId,
        locationId: dto.locationId,
        quantity: dto.quantity,
      },
    });

    // 2. Append immutable stock_ledger entry
    const ledgerEntry = await client.stockLedger.create({
      data: {
        productId: dto.productId,
        locationId: dto.locationId,
        documentId: null,
        qtyDelta: dto.quantity,
        balanceAfter: balance.quantity,
        actorId: dto.actorId,
        postedAt: new Date(),
      },
    });

    this.logger.log(
      `Initial stock recorded: Product=${dto.productId}, Location=${dto.locationId}, Qty=+${dto.quantity}, NewBalance=${balance.quantity}`,
    );

    return { ledgerEntry, balance };
  }

  /**
   * Append-only ledger write helper for inventory transactions.
   * INVARIANT: Never bypass this method or write to stock_balances directly.
   */
  async append(
    entry: AppendLedgerEntryDto,
    txClient?: Prisma.TransactionClient,
  ): Promise<StockLedger> {
    const executeInTx = async (tx: Prisma.TransactionClient) => {
      // Fetch or initialize current balance
      const current = await tx.stockBalance.findUnique({
        where: {
          productId_locationId: {
            productId: entry.productId,
            locationId: entry.locationId,
          },
        },
      });

      const currentQty = current?.quantity ?? 0;
      const newQty = currentQty + entry.qtyDelta;

      if (newQty < 0) {
        throw new BadRequestException(
          `Insufficient stock at location: current=${currentQty}, requested delta=${entry.qtyDelta}`,
        );
      }

      const balance = await tx.stockBalance.upsert({
        where: {
          productId_locationId: {
            productId: entry.productId,
            locationId: entry.locationId,
          },
        },
        update: {
          quantity: newQty,
        },
        create: {
          productId: entry.productId,
          locationId: entry.locationId,
          quantity: newQty,
        },
      });

      const ledgerEntry = await tx.stockLedger.create({
        data: {
          productId: entry.productId,
          locationId: entry.locationId,
          documentId: entry.documentId ?? null,
          qtyDelta: entry.qtyDelta,
          balanceAfter: entry.balanceAfter ?? balance.quantity,
          actorId: entry.actorId,
          postedAt: entry.postedAt ?? new Date(),
        },
      });

      return ledgerEntry;
    };

    if (txClient) {
      return executeInTx(txClient);
    } else {
      return this.prisma.$transaction((tx) => executeInTx(tx));
    }
  }

  /**
   * Read-model query for current on-hand stock quantity.
   */
  async getBalance(
    productId: string,
    locationId: string,
    txClient?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = txClient || this.prisma;
    const balance = await client.stockBalance.findUnique({
      where: {
        productId_locationId: {
          productId,
          locationId,
        },
      },
    });

    return balance?.quantity ?? 0;
  }
}
