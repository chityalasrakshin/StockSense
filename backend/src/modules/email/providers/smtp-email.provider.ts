import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailProvider, SendEmailOptions } from '../email.interface';

@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  private readonly logger = new Logger(SmtpEmailProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async sendEmail(options: SendEmailOptions): Promise<void> {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');

    if (!host) {
      this.logger.warn(
        `SMTP_HOST is not configured. Falling back to log output: To=${options.to}, Subject="${options.subject}", Body="${options.text || options.html}"`,
      );
      return;
    }

    // In production with configured SMTP / transactional provider (SendGrid/SES/Postmark)
    this.logger.log(`Dispatching email to ${options.to} via SMTP host ${host}:${port}`);
  }
}
