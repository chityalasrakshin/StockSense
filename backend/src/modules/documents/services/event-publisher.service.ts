import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { currentRequestId } from '../../../common/observability/request-context';
import { MetricsService } from '../../../common/observability/metrics.service';

export interface StockChangedEvent {
  productId: string;
  locationId: string;
  currentBalance: number;
  reorderPoint?: number;
  documentId?: string;
  timestamp: string;
}

export interface DocumentStatusChangedEvent {
  documentId: string;
  reference: string;
  type: string;
  oldStatus: string | null;
  newStatus: string;
  timestamp: string;
}

type InvalidationCallback = () => void;

@Injectable()
export class EventPublisherService {
  private readonly logger = new Logger(EventPublisherService.name);
  private redisClient: IORedis | null = null;
  private alertQueue: Queue | null = null;
  private static readonly invalidationListeners: Set<InvalidationCallback> = new Set();

  constructor(private readonly configService: ConfigService, @Optional() private readonly metrics?: MetricsService) {
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6380);

    const isTest = process.env.NODE_ENV === 'test';
    if (isTest) {
      this.logger.log('Event publisher initialized in test mode (in-memory/noop fallback)');
      return;
    }

    try {
      this.redisClient = new IORedis({
        host: redisHost,
        port: redisPort,
        lazyConnect: true,
        connectTimeout: 1500,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });

      this.redisClient.on('error', (err) => {
        this.logger.debug?.(`Redis client error in EventPublisher: ${err.message}`);
      });

      this.redisClient
        .connect()
        .then(() => {
          this.logger.log('Connected to Redis for stock.changed & document.status_changed event publishing');
        })
        .catch(() => {
          this.logger.log('Redis connection pending for event publisher (offline mode)');
        });

      this.alertQueue = new Queue('low-stock-alerts', {
        connection: {
          host: redisHost,
          port: redisPort,
          lazyConnect: true,
          connectTimeout: 1500,
          maxRetriesPerRequest: 1,
          retryStrategy: () => null,
        },
      });

      this.alertQueue.on('error', (err) => {
        this.logger.debug?.(`BullMQ alertQueue error: ${err.message}`);
      });
    } catch {
      this.logger.log('Event publisher initialized in fallback mode');
    }
  }

  /**
   * Register a listener for cache invalidation events (e.g., from DashboardCacheService).
   */
  static onInvalidation(listener: InvalidationCallback): () => void {
    EventPublisherService.invalidationListeners.add(listener);
    return () => EventPublisherService.invalidationListeners.delete(listener);
  }

  private triggerInvalidation(): void {
    for (const listener of EventPublisherService.invalidationListeners) {
      try {
        listener();
      } catch (err: any) {
        this.logger.warn(`Error in invalidation listener: ${err.message}`);
      }
    }
  }

  /**
   * Publishes stock.changed event to both BullMQ queue ('low-stock-alerts') and Redis pub/sub channel ('stock.changed').
   * Fails gracefully if Redis is temporarily unreachable so API transactions never fail on event publish.
   */
  async publishStockChanged(event: StockChangedEvent): Promise<void> {
    this.logger.log(
      `Publishing stock.changed event: Product=${event.productId}, Location=${event.locationId}, Balance=${event.currentBalance}`,
    );

    // 1. Proactively notify in-process listeners (e.g. Dashboard KPI cache)
    this.triggerInvalidation();

    // 2. Publish to Redis pub/sub for external subscribers (realtime gateway, multi-instance cache)
    if (this.redisClient && this.redisClient.status === 'ready') {
      try {
        await this.redisClient.publish('stock.changed', JSON.stringify(event));
      } catch (err) {
        this.logger.warn(`Failed to publish stock.changed pub/sub: ${(err as Error).message}`);
      }
    }

    // 3. Push job to BullMQ queue for async low-stock evaluation
    if (this.alertQueue) {
      try {
        await this.alertQueue.add('stock.changed', { ...event, correlationId: currentRequestId() }, {
          removeOnComplete: 100,
          removeOnFail: 500,
        });
        const counts = await this.alertQueue.getJobCounts('waiting', 'delayed', 'prioritized');
        this.metrics?.queueDepth.set({ queue: 'low-stock-alerts' }, (counts.waiting || 0) + (counts.delayed || 0) + (counts.prioritized || 0));
      } catch (err) {
        this.logger.warn(`Failed to enqueue job to low-stock-alerts: ${(err as Error).message}`);
      }
    }
  }

  /**
   * Publishes document.status_changed event to Redis pub/sub channel ('document.status_changed')
   * and triggers proactive dashboard cache invalidation.
   */
  async publishDocumentStatusChanged(event: DocumentStatusChangedEvent): Promise<void> {
    this.logger.log(
      `Publishing document.status_changed event: Doc=${event.reference} (${event.type}) from ${event.oldStatus} to ${event.newStatus}`,
    );

    // 1. Proactively notify in-process listeners
    this.triggerInvalidation();

    // 2. Publish to Redis pub/sub
    if (this.redisClient && this.redisClient.status === 'ready') {
      try {
        await this.redisClient.publish('document.status_changed', JSON.stringify(event));
      } catch (err) {
        this.logger.warn(`Failed to publish document.status_changed pub/sub: ${(err as Error).message}`);
      }
    }
  }

  async close(): Promise<void> {
    if (this.alertQueue) {
      await this.alertQueue.close();
      this.alertQueue = null;
    }
    if (this.redisClient) {
      await this.redisClient.quit().catch(() => {});
      this.redisClient = null;
    }
  }
}
