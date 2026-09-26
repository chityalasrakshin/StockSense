import IORedis from 'ioredis';
import * as dotenv from 'dotenv';

dotenv.config();

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6380', 10);
const redisPassword = process.env.REDIS_PASSWORD || undefined;

export function getRedisConnection(): IORedis {
  return new IORedis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });
}

export const redisConnection = getRedisConnection();
