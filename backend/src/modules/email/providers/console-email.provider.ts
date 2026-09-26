import { Injectable, Logger } from '@nestjs/common';
import { EmailProvider, SendEmailOptions } from '../email.interface';

@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger('DevConsoleEmailProvider');

  async sendEmail(options: SendEmailOptions): Promise<void> {
    const separator = '═'.repeat(64);
    this.logger.log(
      `\n╔${separator}╗\n║ [DEV EMAIL PROVIDER] (Simulated Outgoing Transactional Email)\n╠${separator}╣\n║ TO:      ${options.to}\n║ SUBJECT: ${options.subject}\n║ BODY:\n║   ${options.text || options.html}\n╚${separator}╝`,
    );
  }
}
