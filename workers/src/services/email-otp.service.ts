import { EmailService } from '../email/email.service';

export interface ProcessEmailOtpParams {
  email: string;
  otp: string;
  ttlMinutes: number;
}

export class EmailOtpService {
  private readonly emailService: EmailService;

  constructor(emailService?: EmailService) {
    this.emailService = emailService ?? new EmailService();
  }

  async processEmailOtp(params: ProcessEmailOtpParams): Promise<void> {
    const { email, otp, ttlMinutes } = params;
    console.log(`[EmailOtpService] Sending OTP verification code to ${email}...`);
    await this.emailService.sendPasswordResetOtp(email, otp, ttlMinutes);
    console.log(`[EmailOtpService] Successfully dispatched OTP email to ${email}`);
  }
}
