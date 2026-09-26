import { EmailProvider, SendEmailOptions } from './email.interface';

export class ConsoleEmailProvider implements EmailProvider {
  async sendEmail(options: SendEmailOptions): Promise<void> {
    console.log('\n================== [WORKER: OUTGOING EMAIL] ==================');
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    if (options.text) {
      console.log(`Body (Plain Text):\n${options.text}`);
    }
    console.log('==============================================================\n');
  }
}
