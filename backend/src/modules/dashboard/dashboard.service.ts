import { Injectable, Logger } from '@nestjs/common';
import { DocumentStatus, DocumentType, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DashboardCacheService } from './services/dashboard-cache.service';
import { DashboardKpisDto } from './dtos/dashboard-kpis.dto';
import {
  FiltersMetadataDto,
  FilterOptionDto,
  WarehouseFilterOptionDto,
  CategoryFilterOptionDto,
} from './dtos/filters-metadata.dto';
import { AlertsQueryDto, PaginatedAlertsDto, LowStockAlertItemDto } from './dtos/alerts.dto';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: DashboardCacheService,
  ) {}

  /**
   * Retrieves high-level dashboard KPIs:
   * - Total Products in Stock (distinct products with positive on-hand quantity)
   * - Low Stock / Out of Stock Items (at or below reorder threshold)
   * - Pending Receipts (DRAFT, WAITING, READY)
   * - Pending Deliveries (DRAFT, WAITING, READY)
   * - Internal Transfers Scheduled (DRAFT, WAITING, READY)
   *
   * Computed efficiently off stock_balances and indexed document metadata, NOT by scanning stock_ledger.
   * Results are cached in Redis with proactive invalidation on events.
   */
  async getKpis(): Promise<DashboardKpisDto> {
    // 1. Check Redis cache first
    const cached = await this.cacheService.getCachedKpis();
    if (cached) {
      return cached;
    }

    this.logger.debug('Cache miss for dashboard KPIs — aggregating from database');

    // 2. Parallel aggregation queries directly off indexed read-models
    const [
      inStockProducts,
      openAlertsCount,
      pendingReceipts,
      pendingDeliveries,
      internalTransfersScheduled,
      recentLedgerActivity,
    ] = await Promise.all([
      // Total Products in Stock: Distinct products with positive on-hand stock in stock_balances
      this.prisma.stockBalance.findMany({
        where: { quantity: { gt: 0 } },
        select: { productId: true },
        distinct: ['productId'],
      }),

      // Low Stock / Out of Stock: Count of OPEN alerts in low_stock_alerts
      (this.prisma as any).lowStockAlert?.count({
        where: { status: 'OPEN' },
      }),

      // Pending Receipts: Incoming documents awaiting reception/validation
      this.prisma.document.count({
        where: {
          type: DocumentType.RECEIPT,
          status: { in: [DocumentStatus.DRAFT, DocumentStatus.WAITING, DocumentStatus.READY] },
        },
      }),

      // Pending Deliveries: Outgoing documents awaiting dispatch/validation
      this.prisma.document.count({
        where: {
          type: DocumentType.DELIVERY,
          status: { in: [DocumentStatus.DRAFT, DocumentStatus.WAITING, DocumentStatus.READY] },
        },
      }),

      // Internal Transfers Scheduled: Inter-warehouse transfers in draft, waiting, or ready state
      this.prisma.document.count({
        where: {
          type: DocumentType.TRANSFER,
          status: { in: [DocumentStatus.DRAFT, DocumentStatus.WAITING, DocumentStatus.READY] },
        },
      }),

      // Total ledger transactions recorded
      this.prisma.stockLedger.count(),
    ]);

    // Fallback calculation for low stock count if alert table is not yet populated
    let effectiveLowStockCount = openAlertsCount ?? 0;
    if (openAlertsCount === 0) {
      const allProducts = await this.prisma.product.findMany({
        select: {
          id: true,
          reorderPoint: true,
          balances: { select: { quantity: true } },
        },
      });
      effectiveLowStockCount = allProducts.filter((p) => {
        const totalStock = p.balances.reduce((acc, b) => acc + b.quantity, 0);
        return totalStock <= p.reorderPoint;
      }).length;
    }

    const totalProductsCount = inStockProducts.length;

    const kpis: DashboardKpisDto = {
      totalProductsInStock: totalProductsCount,
      totalProducts: totalProductsCount,
      lowStockItems: effectiveLowStockCount,
      lowStockOrOutOfStockItems: effectiveLowStockCount,
      pendingReceipts,
      pendingDeliveries,
      internalTransfersScheduled,
      internalTransfersCount: internalTransfersScheduled,
      recentLedgerActivity,
    };

    // 3. Cache freshly computed metrics
    await this.cacheService.setCachedKpis(kpis);

    return kpis;
  }

  /**
   * Returns dynamic filter metadata according to the PDF's "Dynamic Filters" specification:
   * - By document type: Receipts / Delivery / Internal / Adjustments
   * - By status: Draft, Waiting, Ready, Done, Canceled
   * - By warehouse or location
   * - By product category
   */
  async getFiltersMetadata(): Promise<FiltersMetadataDto> {
    const [locations, categories] = await Promise.all([
      this.prisma.location.findMany({
        select: {
          id: true,
          name: true,
          shortCode: true,
          type: true,
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.category.findMany({
        select: {
          id: true,
          name: true,
          parentId: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    const documentTypes: FilterOptionDto[] = [
      { label: 'Receipts', value: 'RECEIPT' },
      { label: 'Delivery', value: 'DELIVERY' },
      { label: 'Internal', value: 'TRANSFER' },
      { label: 'Adjustments', value: 'ADJUSTMENT' },
    ];

    const statuses: FilterOptionDto[] = [
      { label: 'Draft', value: 'DRAFT' },
      { label: 'Waiting', value: 'WAITING' },
      { label: 'Ready', value: 'READY' },
      { label: 'Done', value: 'DONE' },
      { label: 'Canceled', value: 'CANCELED' },
    ];

    const warehouses: WarehouseFilterOptionDto[] = locations.map((loc) => ({
      id: loc.id,
      name: loc.name,
      label: `${loc.name} [${loc.shortCode}]`,
      value: loc.id,
      shortCode: loc.shortCode,
      type: loc.type,
    }));

    const categoryOptions: CategoryFilterOptionDto[] = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      label: cat.name,
      value: cat.id,
      parentId: cat.parentId,
    }));

    return {
      documentTypes,
      statuses,
      warehouses,
      categories: categoryOptions,
    };
  }

  /**
   * Retrieves paginated low-stock alerts backing the "Low Stock / Out of Stock Items" KPI drill-down.
   * Filterable by OPEN / RESOLVED status and searchable by SKU / product name.
   */
  async getAlerts(query: AlertsQueryDto): Promise<PaginatedAlertsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.product = {
        OR: [
          { sku: { contains: s, mode: 'insensitive' } },
          { name: { contains: s, mode: 'insensitive' } },
        ],
      };
    }

    const [alerts, totalItems] = await Promise.all([
      (this.prisma as any).lowStockAlert?.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              unitCost: true,
            },
          },
          location: {
            select: {
              id: true,
              name: true,
              shortCode: true,
            },
          },
        },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        skip,
        take: limit,
      }),
      (this.prisma as any).lowStockAlert?.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / limit) || 1;

    const items: LowStockAlertItemDto[] = (alerts ?? []).map((a: any) => ({
      id: a.id,
      productId: a.productId,
      locationId: a.locationId,
      currentStock: a.currentStock,
      currentBalance: a.currentStock,
      reorderPoint: a.reorderPoint,
      status: a.status,
      openedAt: a.openedAt.toISOString(),
      resolvedAt: a.resolvedAt ? a.resolvedAt.toISOString() : null,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      product: {
        id: a.product.id,
        sku: a.product.sku,
        name: a.product.name,
        unitCost: Number(a.product.unitCost),
      },
      location: {
        id: a.location.id,
        name: a.location.name,
        shortCode: a.location.shortCode,
      },
    }));

    return {
      items,
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
      },
    };
  }

  /**
   * Manually invalidate KPI cache (used in testing or administrative actions).
   */
  async invalidateKpisCache(): Promise<void> {
    await this.cacheService.invalidateKpisCache();
  }
}
