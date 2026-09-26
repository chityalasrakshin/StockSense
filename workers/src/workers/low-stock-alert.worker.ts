import { Worker, Job } from 'bullmq';
import { redisConnection } from '../index';

export interface LowStockAlertPayload {
  productId: string;
  locationId: string;
  currentBalance: number;
  reorderPoint: number;
}

export function createLowStockAlertWorker() {
  return new Worker<LowStockAlertPayload>(
    'low-stock-alerts',
    async (job: Job<LowStockAlertPayload>) => {
      console.log(`[Worker: low-stock-alert] Processing alert for product ${job.data.productId}`);
      // Evaluated in Phase 5 upon document validation and ledger update
      return { processed: true };
    },
    { connection: redisConnection },
  );
}
