import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { Subject } from 'rxjs';

export interface RealtimeEvent {
  type: 'stock.changed' | 'document.status_changed' | 'alert.low_stock';
  data: Record<string, unknown>;
}

@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly eventsSubject = new Subject<RealtimeEvent>();
  private subscriber: IORedis | null = null;

  constructor(private readonly config: ConfigService) {}

  events() {
    return this.eventsSubject.asObservable();
  }

  async onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.subscriber = new IORedis({
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get<string>('REDIS_PASSWORD'),
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    this.subscriber.on('error', (error) => this.logger.warn(`Realtime Redis error: ${error.message}`));
    this.subscriber.on('message', (channel, raw) => {
      if (!['stock.changed', 'document.status_changed', 'alert.low_stock'].includes(channel)) return;
      try {
        this.eventsSubject.next({ type: channel as RealtimeEvent['type'], data: JSON.parse(raw) });
      } catch {
        this.logger.warn('Ignored malformed stock.changed event');
      }
    });
    try {
      await this.subscriber.connect();
      await this.subscriber.subscribe('stock.changed', 'document.status_changed', 'alert.low_stock');
      this.logger.log('Realtime subscriber listening on Redis event channels');
    } catch (error) {
      this.logger.warn(`Realtime disabled until Redis is available: ${(error as Error).message}`);
      this.subscriber.disconnect();
      this.subscriber = null;
    }
  }

  async onModuleDestroy() {
    this.eventsSubject.complete();
    if (this.subscriber) await this.subscriber.quit();
  }
}
