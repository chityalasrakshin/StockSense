import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { OtpProducerService } from './otp-producer.service';
import { MetricsService } from '../../../common/observability/metrics.service';

export const OTP_EXPIRATION_MINUTES = 10;
export const MAX_OTP_REQUESTS_IN_WINDOW = 3;
export const RATE_LIMIT_WINDOW_MINUTES = 5;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly otpProducerService: OtpProducerService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  /**
   * Generates a secure, 6-digit numeric OTP code.
   */
  generateNumericOtp(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Hashes an OTP code with bcrypt before storing in database.
   * INVARIANT: Plaintext OTP is NEVER stored at rest in the database.
   */
  async hashOtp(otp: string): Promise<string> {
    return bcrypt.hash(otp, 10);
  }

  /**
   * Verifies a candidate OTP against a bcrypt hash.
   */
  async verifyOtpHash(otp: string, hash: string): Promise<boolean> {
    return bcrypt.compare(otp, hash);
  }

  /**
   * Requests a password reset OTP for the specified email.
   * Rate limited: max 3 requests per 5 minutes per user account.
   */
  async requestPasswordResetOtp(email: string): Promise<{ message: string }> {
    this.metrics?.otpRequests.inc();
    const genericSuccess = {
      message: 'If an active account exists with that email, a password reset code has been sent.',
    };

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || !user.isActive) {
      this.logger.warn(`OTP request for non-existent or inactive email: ${email}`);
      return genericSuccess;
    }

    // Rate limiting check: verify count of recent OTP requests for this user
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
    const recentCount = await this.prisma.otpCode.count({
      where: {
        userId: user.id,
        purpose: 'PASSWORD_RESET',
        createdAt: { gte: windowStart },
      },
    });

    if (recentCount >= MAX_OTP_REQUESTS_IN_WINDOW) {
      this.logger.warn(
        `Rate limit exceeded: User ${email} requested ${recentCount} OTPs within ${RATE_LIMIT_WINDOW_MINUTES}m window`,
      );
      throw new HttpException(
        'Too many OTP requests. Please wait 5 minutes before requesting another code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Generate 6-digit numeric OTP
    const rawOtp = this.generateNumericOtp();
    this.logger.log(`[OtpService] DEV-ONLY: Generated 6-digit OTP for ${user.email}: ${rawOtp}`);

    // Hash at rest - NEVER store plaintext code in database
    const codeHash = await this.hashOtp(rawOtp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000);

    // Invalidate previous unconsumed OTPs for this user
    await this.prisma.otpCode.updateMany({
      where: {
        userId: user.id,
        purpose: 'PASSWORD_RESET',
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
      },
    });

    // Store hashed code in otp_codes
    await this.prisma.otpCode.create({
      data: {
        userId: user.id,
        codeHash,
        purpose: 'PASSWORD_RESET',
        expiresAt,
      },
    });

    // Asynchronous dispatch via worker queue (non-blocking)
    await this.otpProducerService.enqueueOtpEmail({
      email: user.email,
      otp: rawOtp,
      ttlMinutes: OTP_EXPIRATION_MINUTES,
    });

    return genericSuccess;
  }

  /**
   * Verifies an OTP and marks it consumed (single-use).
   * Throws BadRequestException if invalid, expired, or already consumed.
   */
  async verifyAndConsumeOtp(
    email: string,
    otp: string,
    purpose = 'PASSWORD_RESET',
  ): Promise<{ userId: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || !user.isActive) {
      throw new BadRequestException('Invalid or expired OTP verification code');
    }

    // Find active unconsumed OTPs
    const activeOtps = await this.prisma.otpCode.findMany({
      where: {
        userId: user.id,
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (activeOtps.length === 0) {
      throw new BadRequestException('Invalid or expired OTP verification code');
    }

    let matchedOtpId: string | null = null;
    for (const record of activeOtps) {
      const isMatch = await this.verifyOtpHash(otp, record.codeHash);
      if (isMatch) {
        matchedOtpId = record.id;
        break;
      }
    }

    if (!matchedOtpId) {
      throw new BadRequestException('Invalid or expired OTP verification code');
    }

    // Mark consumed immediately to enforce single-use invariant
    await this.prisma.otpCode.update({
      where: { id: matchedOtpId },
      data: { consumedAt: new Date() },
    });

    return { userId: user.id };
  }
}
