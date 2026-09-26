import { PrismaClient } from '@prisma/client';
import IORedis from 'ioredis';

export type ReorderAction = 'OPEN_ALERT' | 'RESOLVE_ALERT' | 'UPDATE_STOCK' | 'NO_OP';

export interface EvaluateReorderThresholdParams {
  currentBalance: number;
  reorderPoint: number;
  previousStatus: 'OPEN' | 'RESOLVED' | null;
}

export interface ReorderEvaluationResult {
  action: ReorderAction;
  nextStatus: 'OPEN' | 'RESOLVED' | null;
  shouldPublish: boolean;
}

/**
 * Pure evaluation function for stock level vs reorder point.
 * Adapted from the community ERPNext pattern:
 * - Stock dropping at or below reorder threshold opens a self-resolving alert.
 * - Stock recovering strictly above reorder threshold auto-resolves the open alert.
 * - Flat stock or movements not crossing the threshold do not spam alerts.
 */
export function evaluateReorderThreshold(
  params: EvaluateReorderThresholdParams,
): ReorderEvaluationResult {
  const { currentBalance, reorderPoint, previousStatus } = params;

  if (currentBalance <= reorderPoint) {
    if (previousStatus === 'OPEN') {
      // Already open - update on-hand stock without creating new alert
      return {
        action: 'UPDATE_STOCK',
        nextStatus: 'OPEN',
        shouldPublish: false,
      };
    }
    // Crossed down into low stock (or newly detected)
    return {
      action: 'OPEN_ALERT',
      nextStatus: 'OPEN',
      shouldPublish: true,
    };
  }

  // currentBalance > reorderPoint
  if (previousStatus === 'OPEN') {
    // Recovered above threshold - auto-resolve existing alert
    return {
      action: 'RESOLVE_ALERT',
      nextStatus: 'RESOLVED',
      shouldPublish: true,
    };
  }

  if (previousStatus === 'RESOLVED') {
    // Still healthy, update stock level on resolved record
    return {
      action: 'UPDATE_STOCK',
      nextStatus: 'RESOLVED',
      shouldPublish: false,
    };
  }

  // Healthy and no prior alert record
  return {
    action: 'NO_OP',
    nextStatus: null,
    shouldPublish: false,
  };
}

export interface ProcessStockChangedParams {
  productId: string;
  locationId: string;
  currentBalance: number;
  reorderPoint?: number;
}

export class LowStockAlertService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redisClient: IORedis,
  ) {}

  async processStockChanged(params: ProcessStockChangedParams): Promise<{
    action: ReorderAction;
    alertId?: string;
    status?: 'OPEN' | 'RESOLVED';
  }> {
    const { productId, locationId, currentBalance } = params;

    // 1. Fetch product to determine reorder point
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        sku: true,
        name: true,
        reorderPoint: true,
      },
    });

    if (!product) {
      console.warn(`[LowStockAlertService] Product "${productId}" not found. Skipping.`);
      return { action: 'NO_OP' };
    }

    const effectiveReorderPoint = params.reorderPoint ?? product.reorderPoint;

    // 2. Fetch existing alert row for this product + location
    const existingAlert = await this.prisma.lowStockAlert.findUnique({
      where: {
        productId_locationId: {
          productId,
          locationId,
        },
      },
    });

    const previousStatus = existingAlert ? (existingAlert.status as 'OPEN' | 'RESOLVED') : null;

    // 3. Evaluate threshold crossing
    const evaluation = evaluateReorderThreshold({
      currentBalance,
      reorderPoint: effectiveReorderPoint,
      previousStatus,
    });

    if (evaluation.action === 'NO_OP') {
      return { action: 'NO_OP' };
    }

    if (evaluation.action === 'OPEN_ALERT') {
      // Upsert alert row in OPEN state
      const alert = await this.prisma.lowStockAlert.upsert({
        where: {
          productId_locationId: {
            productId,
            locationId,
          },
        },
        update: {
          currentStock: currentBalance,
          reorderPoint: effectiveReorderPoint,
          status: 'OPEN',
          openedAt: existingAlert?.status === 'OPEN' ? existingAlert.openedAt : new Date(),
          resolvedAt: null,
        },
        create: {
          productId,
          locationId,
          currentStock: currentBalance,
          reorderPoint: effectiveReorderPoint,
          status: 'OPEN',
          openedAt: new Date(),
        },
      });

      console.log(
        `[LowStockAlertService] Alert OPENED: Product=${product.sku} at Location=${locationId}, Stock=${currentBalance} <= ReorderPoint=${effectiveReorderPoint}`,
      );

      // Publish alert.low_stock event for realtime gateway
      await this.publishAlertEvent({
        alertId: alert.id,
        productId,
        productSku: product.sku,
        productName: product.name,
        locationId,
        currentStock: currentBalance,
        reorderPoint: effectiveReorderPoint,
        status: 'OPEN',
      });

      return { action: 'OPEN_ALERT', alertId: alert.id, status: 'OPEN' };
    }

    if (evaluation.action === 'RESOLVE_ALERT' && existingAlert) {
      // Auto-resolve existing alert (not a duplicate)
      const alert = await this.prisma.lowStockAlert.update({
        where: { id: existingAlert.id },
        data: {
          currentStock: currentBalance,
          status: 'RESOLVED',
          resolvedAt: new Date(),
        },
      });

      console.log(
        `[LowStockAlertService] Alert AUTO-RESOLVED: Product=${product.sku} at Location=${locationId}, Stock recovered to ${currentBalance} > ReorderPoint=${effectiveReorderPoint}`,
      );

      // Publish alert.low_stock event with RESOLVED status
      await this.publishAlertEvent({
        alertId: alert.id,
        productId,
        productSku: product.sku,
        productName: product.name,
        locationId,
        currentStock: currentBalance,
        reorderPoint: effectiveReorderPoint,
        status: 'RESOLVED',
      });

      return { action: 'RESOLVE_ALERT', alertId: alert.id, status: 'RESOLVED' };
    }

    if (evaluation.action === 'UPDATE_STOCK' && existingAlert) {
      await this.prisma.lowStockAlert.update({
        where: { id: existingAlert.id },
        data: {
          currentStock: currentBalance,
        },
      });
      return { action: 'UPDATE_STOCK', alertId: existingAlert.id, status: existingAlert.status as any };
    }

    return { action: 'NO_OP' };
  }

  private async publishAlertEvent(data: {
    alertId: string;
    productId: string;
    productSku: string;
    productName: string;
    locationId: string;
    currentStock: number;
    reorderPoint: number;
    status: 'OPEN' | 'RESOLVED';
  }): Promise<void> {
    try {
      if (this.redisClient.status === 'ready') {
        await this.redisClient.publish(
          'alert.low_stock',
          JSON.stringify({
            ...data,
            timestamp: new Date().toISOString(),
          }),
        );
      }
    } catch (err: any) {
      console.warn(`[LowStockAlertService] Failed to publish alert.low_stock: ${err.message}`);
    }
  }
}
