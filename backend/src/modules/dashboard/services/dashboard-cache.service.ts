import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { DashboardKpisDto } from '../dtos/dashboard-kpis.dto';
import { EventPublisherService } from '../../documents/services/event-publisher.service';

export const DASHBOARD_KPIS_CACHE_KEY = 'dashboard:kpis';
export const DEFAULT_KPI_TTL_SECONDS = 10; // Short TTL of a few seconds per architecture

@Injectable()
export class DashboardCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DashboardCacheService.name);
  private memoryCache: { data: DashboardKpisDto; expiresAt: number } | null = null;
  private redisClient: IORedis | null = null;
  private subscriberClient: IORedis | null = null;
  private unsubscribePublisherHook: (() => void) | null = null;

  constructor(private readonly configService: ConfigService) {
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6380);

    const isTest = process.env.NODE_ENV === 'test';
    if (!isTest) {
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
          this.logger.debug?.(`Redis cache client error: ${err.message}`);
        });

        this.redisClient
          .connect()
          .then(() => {
            this.logger.log('DashboardCacheService connected to Redis cache store');
          })
          .catch(() => {
            this.logger.log('Redis cache store offline — using in-memory store');
          });

        // Dedicated subscriber connection for pub/sub events
        this.subscriberClient = new IORedis({
          host: redisHost,
          port: redisPort,
          lazyConnect: true,
          connectTimeout: 1500,
          maxRetriesPerRequest: 1,
          retryStrategy: () => null,
        });

        this.subscriberClient.on('error', (err) => {
          this.logger.debug?.(`Redis subscriber client error: ${err.message}`);
        });
      } catch {
        this.logger.log('Redis cache client initialization skipped — using in-memory store');
      }
    }

    // Register in-process invalidation hook immediately
    this.unsubscribePublisherHook = EventPublisherService.onInvalidation(() => {
      this.logger.log('In-process event detected — proactively invalidating KPI cache');
      void this.invalidateKpisCache();
    });
  }

  async onModuleInit(): Promise<void> {
    // Redis pub/sub subscriber for distributed, multi-instance invalidation
    if (this.subscriberClient) {
      try {
        await this.subscriberClient.connect();
        await this.subscriberClient.subscribe('stock.changed', 'document.status_changed');
        this.subscriberClient.on('message', (channel) => {
          this.logger.log(
            `Redis pub/sub event received on channel [${channel}] — proactively invalidating KPI cache`,
          );
          void this.invalidateKpisCache();
        });
      } catch (err: any) {
        this.logger.debug?.(`Redis pub/sub subscribe deferred: ${err.message}`);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.unsubscribePublisherHook) {
      this.unsubscribePublisherHook();
      this.unsubscribePublisherHook = null;
    }
    if (this.subscriberClient) {
      await this.subscriberClient.quit().catch(() => {});
      this.subscriberClient = null;
    }
    if (this.redisClient) {
      await this.redisClient.quit().catch(() => {});
      this.redisClient = null;
    }
  }

  /**
   * Retrieves cached KPI metrics from Redis (or in-memory fallback).
   */
  async getCachedKpis(): Promise<DashboardKpisDto | null> {
    // 1. Check in-memory store
    if (this.memoryCache && Date.now() < this.memoryCache.expiresAt) {
      return this.memoryCache.data;
    }

    // 2. Check Redis store
    if (this.redisClient && this.redisClient.status === 'ready') {
      try {
        const raw = await this.redisClient.get(DASHBOARD_KPIS_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as DashboardKpisDto;
          // Hydrate local cache
          this.memoryCache = {
            data: parsed,
            expiresAt: Date.now() + DEFAULT_KPI_TTL_SECONDS * 1000,
          };
          return parsed;
        }
      } catch (err: any) {
        this.logger.warn(`Redis getCachedKpis failed: ${err.message}`);
      }
    }

    return null;
  }

  /**
   * Stores freshly computed KPI metrics with a short TTL.
   */
  async setCachedKpis(
    kpis: DashboardKpisDto,
    ttlSeconds: number = DEFAULT_KPI_TTL_SECONDS,
  ): Promise<void> {
    this.memoryCache = {
      data: kpis,
      expiresAt: Date.now() + ttlSeconds * 1000,
    };

    if (this.redisClient && this.redisClient.status === 'ready') {
      try {
        await this.redisClient.set(
          DASHBOARD_KPIS_CACHE_KEY,
          JSON.stringify(kpis),
          'EX',
          ttlSeconds,
        );
      } catch (err: any) {
        this.logger.warn(`Redis setCachedKpis failed: ${err.message}`);
      }
    }
  }

  /**
   * Proactively invalidates the cached KPIs when inventory movements or document states change.
   */
  async invalidateKpisCache(): Promise<void> {
    this.memoryCache = null;

    if (this.redisClient && this.redisClient.status === 'ready') {
      try {
        await this.redisClient.del(DASHBOARD_KPIS_CACHE_KEY);
        this.logger.log('Proactive KPI cache invalidation complete on Redis store');
      } catch (err: any) {
        this.logger.warn(`Redis invalidateKpisCache failed: ${err.message}`);
      }
    }
  }
}
