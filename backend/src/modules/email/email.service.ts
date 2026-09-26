import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL_PROVIDER, EmailProvider, SendEmailOptions } from './email.interface';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    private readonly configService: ConfigService,
  ) {}

  async sendEmail(options: SendEmailOptions): Promise<void> {
    try {
      await this.emailProvider.sendEmail(options);
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${options.to}: ${err.message}`, err.stack);
      throw err;
    }
  }

  async sendPasswordResetOtp(email: string, otp: string, ttlMinutes: number): Promise<void> {
    const subject = '[StockSense] Password Reset Verification Code';
    const text = `Hello,\n\nYour StockSense password reset verification code is: ${otp}\n\nThis code will expire in ${ttlMinutes} minutes. If you did not request a password reset, please ignore this email or contact your inventory administrator immediately.\n\nBest regards,\nStockSense Security Team`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0f172a; margin-bottom: 16px;">StockSense Password Reset</h2>
        <p style="color: #475569; font-size: 15px;">You recently requested to reset your password for StockSense.</p>
        <div style="background-color: #f1f5f9; padding: 16px; border-radius: 6px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1e293b;">${otp}</span>
        </div>
        <p style="color: #64748b; font-size: 13px;">This code is valid for <strong>${ttlMinutes} minutes</strong> and can only be used once.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px;">If you did not request this verification code, you can safely disregard this email.</p>
      </div>
    `;

    await this.sendEmail({
      to: email,
      subject,
      text,
      html,
    });
  }
}
