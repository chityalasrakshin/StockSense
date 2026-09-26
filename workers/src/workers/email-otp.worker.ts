import { Worker, Job } from 'bullmq';
import { redisConnection } from '../index';

export interface EmailOtpPayload {
  to: string;
  code: string;
  expiresInMinutes: number;
}

export function createEmailOtpWorker() {
  return new Worker<EmailOtpPayload>(
    'email-otp',
    async (job: Job<EmailOtpPayload>) => {
      console.log(`[Worker: email-otp] Dispatching OTP email to ${job.data.to}`);
      // Evaluated in Phase 9 upon auth password reset request
      return { sent: true };
    },
    { connection: redisConnection },
  );
}
