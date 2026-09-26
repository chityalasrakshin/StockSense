import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export interface StockChangedEvent {
  productId: string;
  locationId: string;
  currentBalance: number;
  reorderPoint?: number;
  documentId?: string;
  timestamp: string;
}

@Injectable()
export class EventPublisherService {
  private readonly logger = new Logger(EventPublisherService.name);
  private redisClient: IORedis | null = null;
  private alertQueue: Queue | null = null;

  constructor(private readonly configService: ConfigService) {
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);

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

      this.redisClient.connect().then(() => {
        this.logger.log('Connected to Redis for stock.changed event publishing');
      }).catch(() => {
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
   * Publishes stock.changed event to both BullMQ queue ('low-stock-alerts') and Redis pub/sub channel ('stock.changed').
   * Fails gracefully if Redis is temporarily unreachable so API transactions never fail on event publish.
   */
  async publishStockChanged(event: StockChangedEvent): Promise<void> {
    this.logger.log(
      `Publishing stock.changed event: Product=${event.productId}, Location=${event.locationId}, Balance=${event.currentBalance}`,
    );

    // 1. Publish to Redis pub/sub
    if (this.redisClient && this.redisClient.status === 'ready') {
      try {
        await this.redisClient.publish('stock.changed', JSON.stringify(event));
      } catch (err) {
        this.logger.warn(`Failed to publish stock.changed pub/sub: ${(err as Error).message}`);
      }
    }

    // 2. Push job to BullMQ queue for async low-stock evaluation (Prompt 6 worker)
    if (this.alertQueue) {
      try {
        await this.alertQueue.add('stock.changed', event, {
          removeOnComplete: 100,
          removeOnFail: 500,
        });
      } catch (err) {
        this.logger.warn(`Failed to enqueue job to low-stock-alerts: ${(err as Error).message}`);
      }
    }
  }
}
