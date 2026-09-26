import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { redisConnection } from '../redis';
import { LowStockAlertService, ProcessStockChangedParams } from '../services/low-stock-alert.service';
import { logger } from '../logger';

export interface LowStockAlertPayload extends ProcessStockChangedParams {
  documentId?: string;
  timestamp?: string;
  correlationId?: string;
}

export function createLowStockAlertWorker(prisma: PrismaClient, redis = redisConnection) {
  const service = new LowStockAlertService(prisma, redis);

  const worker = new Worker<LowStockAlertPayload>(
    'low-stock-alerts',
    async (job: Job<LowStockAlertPayload>) => {
      logger.info({ correlationId: job.data.correlationId, jobId: job.id, event: 'stock.changed', productId: job.data.productId, locationId: job.data.locationId }, 'Processing low-stock job');
      const result = await service.processStockChanged(job.data);
      return result;
    },
    {
      connection: redis,
      concurrency: 5,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id, correlationId: job?.data.correlationId }, 'Low-stock job failed');
  });

  return worker;
}
