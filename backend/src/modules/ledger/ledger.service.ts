import {
  Injectable,
  ConflictException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma, StockLedger, StockBalance } from '@prisma/client';
import { QueryLedgerDto } from './dtos/query-ledger.dto';
import { PaginatedLedgerDto, StockLedgerEntryDto } from './dtos/ledger-response.dto';
import { MetricsService } from '../../common/observability/metrics.service';

export interface AppendLedgerEntryDto {
  productId: string;
  locationId: string;
  documentId?: string | null;
  qtyDelta: number;
  actorId: string;
  postedAt?: Date;
  allowNegative?: boolean;
}

export interface RecordInitialStockDto {
  productId: string;
  locationId: string;
  quantity: number;
  actorId: string;
}

export interface ILedgerService {
  append(
    entry: AppendLedgerEntryDto,
    txClient?: Prisma.TransactionClient,
  ): Promise<StockLedger>;

  recordInitialStock(
    dto: RecordInitialStockDto,
    txClient?: Prisma.TransactionClient,
  ): Promise<{ ledgerEntry: StockLedger; balance: StockBalance }>;

  findMoveHistory(query: QueryLedgerDto): Promise<PaginatedLedgerDto>;

  getBalance(
    productId: string,
    locationId: string,
    txClient?: Prisma.TransactionClient,
  ): Promise<number>;
}

@Injectable()
export class LedgerService implements ILedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(private readonly prisma: PrismaService, @Optional() private readonly metrics?: MetricsService) {}

  /**
   * THE SINGLE WRITE CHOKE POINT:
   * Architectural invariant from architecture.md section 8 & 11:
   * This is the ONLY code path in the entire codebase permitted to insert into
   * `stock_ledger` or mutate `stock_balances`.
   *
   * Executes within a PostgreSQL transaction with pessimistic row-locking (`SELECT ... FOR UPDATE`)
   * to guarantee zero race-condition double counting and strong consistency.
   */
  async append(
    entry: AppendLedgerEntryDto,
    txClient?: Prisma.TransactionClient,
  ): Promise<StockLedger> {
    const executeInTransaction = async (tx: Prisma.TransactionClient): Promise<StockLedger> => {
      // 1. Ensure the target stock_balances row exists so Postgres FOR UPDATE has an actual row to lock
      await tx.$executeRaw`
        INSERT INTO stock_balances (product_id, location_id, quantity, updated_at)
        VALUES (${entry.productId}, ${entry.locationId}, 0, NOW())
        ON CONFLICT (product_id, location_id) DO NOTHING;
      `;

      // 2. Acquire exclusive pessimistic row lock (SELECT ... FOR UPDATE) on the affected balance row
      const lockedRows = await tx.$queryRaw<Array<{ quantity: number }>>`
        SELECT quantity FROM stock_balances
        WHERE product_id = ${entry.productId} AND location_id = ${entry.locationId}
        FOR UPDATE;
      `;

      const currentQty = lockedRows.length > 0 ? Number(lockedRows[0].quantity) : 0;
      const newQty = currentQty + entry.qtyDelta;

      // 3. Strict business-rule check against negative inventory (Clean HTTP 409 conflict, not DB crash)
      if (newQty < 0 && !entry.allowNegative) {
        throw new ConflictException(
          `Insufficient stock for product ${entry.productId} at location ${entry.locationId}: available on-hand is ${currentQty}, attempted reduction is ${Math.abs(entry.qtyDelta)}`,
        );
      }

      // 4. Update the locked stock_balances cache row
      await tx.$executeRaw`
        UPDATE stock_balances
        SET quantity = ${newQty}, updated_at = NOW()
        WHERE product_id = ${entry.productId} AND location_id = ${entry.locationId};
      `;

      // 5. Append immutable Stock Ledger entry
      const ledgerEntry = await tx.stockLedger.create({
        data: {
          productId: entry.productId,
          locationId: entry.locationId,
          documentId: entry.documentId ?? null,
          qtyDelta: entry.qtyDelta,
          balanceAfter: newQty,
          actorId: entry.actorId,
          postedAt: entry.postedAt ?? new Date(),
        },
      });

      this.logger.log(
        `Ledger append: Product=${entry.productId}, Location=${entry.locationId}, Delta=${entry.qtyDelta >= 0 ? '+' : ''}${entry.qtyDelta}, BalanceAfter=${newQty}, Doc=${entry.documentId ?? 'INITIAL'}`,
      );

      this.metrics?.ledgerWrites.inc();
      return ledgerEntry;
    };

    if (txClient) {
      return executeInTransaction(txClient);
    } else {
      return this.prisma.$transaction((tx) => executeInTransaction(tx));
    }
  }

  /**
   * Onboarding helper for initial product stock.
   * Internally routes through `this.append()` to preserve the single-choke-point invariant.
   */
  async recordInitialStock(
    dto: RecordInitialStockDto,
    txClient?: Prisma.TransactionClient,
  ): Promise<{ ledgerEntry: StockLedger; balance: StockBalance }> {
    if (dto.quantity < 0) {
      throw new BadRequestException('Initial stock quantity cannot be negative');
    }

    const ledgerEntry = await this.append(
      {
        productId: dto.productId,
        locationId: dto.locationId,
        documentId: null,
        qtyDelta: dto.quantity,
        actorId: dto.actorId,
      },
      txClient,
    );

    const client = txClient || this.prisma;
    const balance = (await client.stockBalance.findUnique({
      where: {
        productId_locationId: {
          productId: dto.productId,
          locationId: dto.locationId,
        },
      },
    }))!;

    return { ledgerEntry, balance };
  }

  /**
   * Move History: Query the append-only stock_ledger audit trail with filters and pagination.
   */
  async findMoveHistory(query: QueryLedgerDto): Promise<PaginatedLedgerDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.StockLedgerWhereInput = {};

    if (query.product) {
      const p = query.product.trim();
      where.product = {
        OR: [
          { id: p },
          { sku: { equals: p, mode: 'insensitive' } },
          { name: { contains: p, mode: 'insensitive' } },
        ],
      };
    }

    if (query.location) {
      const loc = query.location.trim();
      where.location = {
        OR: [
          { id: loc },
          { shortCode: { equals: loc, mode: 'insensitive' } },
          { name: { contains: loc, mode: 'insensitive' } },
        ],
      };
    }

    if (query.from || query.to) {
      where.postedAt = {};
      if (query.from) {
        where.postedAt.gte = new Date(query.from);
      }
      if (query.to) {
        where.postedAt.lte = new Date(query.to);
      }
    }

    const [entries, totalItems] = await Promise.all([
      this.prisma.stockLedger.findMany({
        where,
        include: {
          product: { select: { id: true, sku: true, name: true } },
          location: { select: { id: true, shortCode: true, name: true, type: true } },
          document: { select: { id: true, reference: true, type: true, status: true } },
          actor: { select: { id: true, email: true, role: true } },
        },
        orderBy: { postedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.stockLedger.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / limit) || 1;

    return {
      items: entries as StockLedgerEntryDto[],
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
      },
    };
  }

  /**
   * Fast O(1) balance check from derived read-model cache.
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
