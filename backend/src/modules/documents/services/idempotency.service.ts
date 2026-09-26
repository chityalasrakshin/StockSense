import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';

export interface IdempotencyRecord {
  documentId: string;
  response: any;
  timestamp: string;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly memoryStore = new Map<string, IdempotencyRecord>();
  private redisClient: IORedis | null = null;
  private readonly ttlSeconds = 86400; // 24 hours

  constructor(private readonly configService: ConfigService) {
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);

    const isTest = process.env.NODE_ENV === 'test';
    if (isTest) {
      this.logger.log('Idempotency using fast in-memory store (test mode)');
      return;
    }

    try {
      this.redisClient = new IORedis({
        host: redisHost,
        port: redisPort,
        lazyConnect: true,
        connectTimeout: 1000,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // don't spam reconnect in offline/test mode
      });

      this.redisClient.on('error', (err) => {
        this.logger.debug?.(`Redis client error in IdempotencyService: ${err.message}`);
      });

      this.redisClient.connect().catch(() => {
        this.logger.log('Redis offline for idempotency — using fast in-memory store.');
      });
    } catch {
      this.logger.log('Redis client init skipped — using fast in-memory store.');
    }
  }

  async get(key: string): Promise<IdempotencyRecord | null> {
    if (!key) return null;

    // Check memory store first
    if (this.memoryStore.has(key)) {
      return this.memoryStore.get(key) || null;
    }

    if (this.redisClient && this.redisClient.status === 'ready') {
      try {
        const raw = await this.redisClient.get(`idempotency:${key}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.memoryStore.set(key, parsed);
          return parsed;
        }
      } catch (err) {
        this.logger.warn(`Redis get failed for idempotency key ${key}: ${(err as Error).message}`);
      }
    }

    return null;
  }

  async set(key: string, data: IdempotencyRecord): Promise<void> {
    if (!key) return;

    this.memoryStore.set(key, data);

    if (this.redisClient && this.redisClient.status === 'ready') {
      try {
        await this.redisClient.set(
          `idempotency:${key}`,
          JSON.stringify(data),
          'EX',
          this.ttlSeconds,
        );
      } catch (err) {
        this.logger.warn(`Redis set failed for idempotency key ${key}: ${(err as Error).message}`);
      }
    }
  }
}
