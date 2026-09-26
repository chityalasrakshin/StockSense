import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { redisConnection } from '../redis';
import { LowStockAlertService, ProcessStockChangedParams } from '../services/low-stock-alert.service';

export interface LowStockAlertPayload extends ProcessStockChangedParams {
  documentId?: string;
  timestamp?: string;
}

export function createLowStockAlertWorker(prisma: PrismaClient, redis = redisConnection) {
  const service = new LowStockAlertService(prisma, redis);

  const worker = new Worker<LowStockAlertPayload>(
    'low-stock-alerts',
    async (job: Job<LowStockAlertPayload>) => {
      console.log(
        `[Worker: low-stock-alert] Processing stock.changed event: Product=${job.data.productId}, Location=${job.data.locationId}, Balance=${job.data.currentBalance}`,
      );
      const result = await service.processStockChanged(job.data);
      return result;
    },
    {
      connection: redis,
      concurrency: 5,
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[Worker: low-stock-alert] Job ${job?.id} failed:`, err);
  });

  return worker;
}
