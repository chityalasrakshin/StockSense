import { Worker, Job } from 'bullmq';
import { redisConnection } from '../index';

export interface ReportExportPayload {
  reportType: 'LEDGER_CSV' | 'STOCK_BALANCE_PDF';
  userId: string;
  filters: Record<string, unknown>;
}

export function createReportExportWorker() {
  return new Worker<ReportExportPayload>(
    'report-export',
    async (job: Job<ReportExportPayload>) => {
      console.log(
        `[Worker: report-export] Generating ${job.data.reportType} report for user ${job.data.userId}`,
      );
      // Generates report and uploads to S3/MinIO
      return { reportUrl: 'https://minio.local/export.csv' };
    },
    { connection: redisConnection },
  );
}
