import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { redisConnection } from './redis';
import { createLowStockAlertWorker } from './workers/low-stock-alert.worker';
import { createEmailOtpWorker } from './workers/email-otp.worker';

dotenv.config();

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6380', 10);

console.log(`[StockSense Workers] Initializing runner service...`);
console.log(`[StockSense Workers] Connecting to Redis at ${redisHost}:${redisPort}...`);

export { redisConnection };

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.DATABASE_URL ||
        'postgresql://stocksense:stocksense@localhost:5432/stocksense?schema=public',
    },
  },
});

async function bootstrap() {
  try {
    await redisConnection.connect();
    console.log('[StockSense Workers] Successfully established connection to Redis.');
  } catch (err: any) {
    console.warn(
      `[StockSense Workers] Redis connection pending (${err.message}). Reconnecting in background...`,
    );
  }

  // Initialize workers
  const lowStockWorker = createLowStockAlertWorker(prisma, redisConnection);
  const emailOtpWorker = createEmailOtpWorker(undefined, redisConnection);

  console.log('[StockSense Workers] Registered active background workers:');
  console.log(' - low-stock-alerts: ACTIVE (processing stock.changed events & threshold alerts)');
  console.log(' - email-otp: ACTIVE (processing otp.requested jobs via swappable email provider)');
  console.log('[StockSense Workers] Service initialized and listening for jobs.');

  const shutdown = async () => {
    console.log('[StockSense Workers] Shutting down workers gracefully...');
    try {
      await Promise.all([
        lowStockWorker.close(),
        emailOtpWorker.close(),
        redisConnection.quit(),
        prisma.$disconnect(),
      ]);
    } catch {
      // ignore errors on exit
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Only auto-run if directly executed (not during tests)
if (process.env.NODE_ENV !== 'test') {
  bootstrap().catch((err) => {
    console.error('[StockSense Workers] Fatal error in worker bootstrap:', err);
    process.exit(1);
  });
}
