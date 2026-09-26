import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { EmailService } from '../../email/email.service';

export interface OtpJobPayload {
  email: string;
  otp: string;
  ttlMinutes: number;
}

@Injectable()
export class OtpProducerService {
  private readonly logger = new Logger(OtpProducerService.name);
  private queue: Queue | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6380);

    const isTest = process.env.NODE_ENV === 'test';
    if (!isTest) {
      try {
        this.queue = new Queue('email-otp', {
          connection: {
            host: redisHost,
            port: redisPort,
            lazyConnect: true,
            connectTimeout: 1500,
            maxRetriesPerRequest: 1,
            retryStrategy: () => null,
          },
        });

        this.queue.on('error', (err) => {
          this.logger.debug?.(`BullMQ email-otp queue error: ${err.message}`);
        });
      } catch (err: any) {
        this.logger.warn(`Failed to initialize email-otp queue: ${err.message}`);
      }
    }
  }

  /**
   * Enqueues an 'otp.requested' job to the async worker queue.
   * If Redis is unreachable or in test mode, falls back to the configured email service
   * so offline/test environments do not fail.
   */
  async enqueueOtpEmail(payload: OtpJobPayload): Promise<void> {
    if (this.queue) {
      try {
        await this.queue.add('otp.requested', payload, {
          removeOnComplete: 100,
          removeOnFail: 500,
        });
        this.logger.log(`Enqueued otp.requested job for ${payload.email}`);
        return;
      } catch (err: any) {
        this.logger.warn(
          `Failed to enqueue otp.requested job: ${err.message}. Invoking email provider fallback.`,
        );
      }
    }

    // Fallback path when queue is not active
    await this.emailService.sendPasswordResetOtp(
      payload.email,
      payload.otp,
      payload.ttlMinutes,
    );
  }

  /**
   * Closes the BullMQ queue gracefully.
   */
  async close(): Promise<void> {
    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }
  }
}
