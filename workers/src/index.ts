import IORedis from 'ioredis';
import * as dotenv from 'dotenv';

dotenv.config();

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisPassword = process.env.REDIS_PASSWORD || undefined;

console.log(`[StockSense Workers] Initializing runner skeleton...`);
console.log(`[StockSense Workers] Connecting to Redis at ${redisHost}:${redisPort}...`);

export const redisConnection = new IORedis({
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

async function bootstrap() {
  try {
    await redisConnection.connect();
    console.log('[StockSense Workers] Successfully established connection to Redis.');
  } catch (err) {
    console.warn(
      `[StockSense Workers] Redis connection pending (${(err as Error).message}). Will reconnect automatically.`,
    );
  }

  console.log('[StockSense Workers] Registered workers skeleton:');
  console.log(' - low-stock-alert: Idle (awaiting Phase 5 document engine)');
  console.log(' - email-otp: Idle (awaiting Phase 9 auth OTP pipeline)');
  console.log(' - report-export: Idle (awaiting report export pipeline)');
  console.log('[StockSense Workers] Runner skeleton initialized and waiting for jobs.');

  const shutdown = async () => {
    console.log('[StockSense Workers] Shutting down workers gracefully...');
    try {
      await redisConnection.quit();
    } catch {
      // ignore
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('[StockSense Workers] Fatal error in worker bootstrap:', err);
  process.exit(1);
});
