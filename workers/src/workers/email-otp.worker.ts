import { Worker, Job } from 'bullmq';
import { redisConnection } from '../redis';
import { EmailOtpService } from '../services/email-otp.service';

export interface EmailOtpPayload {
  email?: string;
  to?: string;
  otp?: string;
  code?: string;
  ttlMinutes?: number;
  expiresInMinutes?: number;
}

export function createEmailOtpWorker(emailOtpService = new EmailOtpService(), redis = redisConnection) {
  const worker = new Worker<EmailOtpPayload>(
    'email-otp',
    async (job: Job<EmailOtpPayload>) => {
      const email = job.data.email || job.data.to;
      const otp = job.data.otp || job.data.code;
      const ttlMinutes = job.data.ttlMinutes || job.data.expiresInMinutes || 10;

      if (!email || !otp) {
        throw new Error(`Invalid email-otp job payload: email or otp missing`);
      }

      console.log(`[Worker: email-otp] Processing job "${job.name}" id=${job.id} for ${email}`);
      await emailOtpService.processEmailOtp({ email, otp, ttlMinutes });
      return { sent: true, recipient: email };
    },
    {
      connection: redis,
      concurrency: 5,
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[Worker: email-otp] Job ${job?.id} failed:`, err);
  });

  return worker;
}
