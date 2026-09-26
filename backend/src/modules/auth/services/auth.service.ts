import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Role, User } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { OtpService } from './otp.service';
import { SignupDto } from '../dtos/signup.dto';
import { LoginDto } from '../dtos/login.dto';
import { OtpVerifyResetDto } from '../dtos/otp-verify-reset.dto';
import { AuthResponseDto } from '../dtos/auth-response.dto';

const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly otpService: OtpService,
  ) {}

  /**
   * Registers a new user, hashes password, creates a refresh token family,
   * sets the httpOnly cookie, and returns access token + profile.
   */
  async signup(signupDto: SignupDto, response: Response): Promise<AuthResponseDto> {
    const email = signupDto.email.toLowerCase().trim();

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('An account with this email address already exists');
    }

    const passwordHash = await bcrypt.hash(signupDto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: signupDto.role || Role.WAREHOUSE_STAFF,
      },
    });

    const accessToken = await this.createSession(user, response);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    };
  }

  /**
   * Authenticates user credentials, rotates in a new refresh token family,
   * sets the httpOnly cookie, and returns access token + profile.
   */
  async login(loginDto: LoginDto, response: Response): Promise<AuthResponseDto> {
    const email = loginDto.email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.createSession(user, response);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    };
  }

  /**
   * Refreshes access token with full rotation and reuse detection.
   * If a revoked token is presented, the whole family is immediately invalidated.
   */
  async refreshTokens(
    rawRefreshToken: string | undefined,
    response: Response,
  ): Promise<{ accessToken: string }> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const tokenHash = this.hashRefreshToken(rawRefreshToken);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken) {
      this.clearRefreshCookie(response);
      throw new UnauthorizedException('Invalid refresh token');
    }

    // --- REUSE DETECTION ---
    // If an already-revoked token is received, the session family has been compromised
    if (storedToken.isRevoked) {
      this.logger.warn(
        `[SECURITY] Refresh token reuse detected for user ${storedToken.userId}, family ${storedToken.family}. Revoking family.`,
      );

      // Invalidate the entire token family
      await this.prisma.refreshToken.updateMany({
        where: { family: storedToken.family },
        data: { isRevoked: true },
      });

      this.clearRefreshCookie(response);
      throw new UnauthorizedException(
        'Refresh token reuse detected. Session family has been revoked.',
      );
    }

    // Check expiration
    if (storedToken.expiresAt < new Date()) {
      this.clearRefreshCookie(response);
      throw new UnauthorizedException('Refresh token has expired. Please log in again.');
    }

    if (!storedToken.user || !storedToken.user.isActive) {
      this.clearRefreshCookie(response);
      throw new UnauthorizedException('User account is deactivated');
    }

    // --- TOKEN ROTATION ---
    // 1. Invalidate current token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    });

    // 2. Issue new refresh token within the SAME family
    const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
    const newTokenHash = this.hashRefreshToken(newRawRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await this.prisma.refreshToken.create({
      data: {
        userId: storedToken.userId,
        tokenHash: newTokenHash,
        family: storedToken.family, // Preserve token family lineage
        isRevoked: false,
        expiresAt,
      },
    });

    // 3. Issue new access token and set new cookie
    const accessToken = this.generateAccessToken(storedToken.user);
    this.setRefreshCookie(response, newRawRefreshToken);

    return { accessToken };
  }

  /**
   * Logs out user: revokes the refresh token family and clears the cookie.
   */
  async logout(
    rawRefreshToken: string | undefined,
    response: Response,
  ): Promise<{ message: string }> {
    if (rawRefreshToken) {
      const tokenHash = this.hashRefreshToken(rawRefreshToken);
      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { tokenHash },
      });

      if (storedToken) {
        await this.prisma.refreshToken.updateMany({
          where: { family: storedToken.family },
          data: { isRevoked: true },
        });
      }
    }

    this.clearRefreshCookie(response);
    return { message: 'Logged out successfully' };
  }

  /**
   * Verifies OTP code and resets the user's password, invalidating old sessions.
   */
  async verifyResetPassword(dto: OtpVerifyResetDto): Promise<{ message: string }> {
    const { userId } = await this.otpService.verifyAndConsumeOtp(
      dto.email,
      dto.otp,
      'PASSWORD_RESET',
    );

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Security best-practice: Revoke all active sessions upon password reset
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });

    return {
      message: 'Password has been reset successfully. Please log in with your new credentials.',
    };
  }

  /**
   * Generates a 15-minute JWT access token with user claims.
   */
  generateAccessToken(user: User | { id: string; email: string; role: Role }): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const expiresIn = this.configService.get<string>('JWT_EXPIRATION', '15m') as any;
    return this.jwtService.sign(payload, {
      expiresIn,
    });
  }

  /**
   * Hashes a refresh token string with SHA-256 for secure storage at rest.
   */
  hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Creates a new session family and stores the initial refresh token.
   */
  private async createSession(user: User, response: Response): Promise<string> {
    const family = crypto.randomUUID();
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        family,
        isRevoked: false,
        expiresAt,
      },
    });

    this.setRefreshCookie(response, rawRefreshToken);
    return this.generateAccessToken(user);
  }

  /**
   * Attaches httpOnly secure cookie containing the rotating refresh token.
   */
  private setRefreshCookie(response: Response, token: string): void {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    response.cookie(REFRESH_TOKEN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: REFRESH_TOKEN_TTL_MS,
    });
  }

  /**
   * Clears the refresh token cookie.
   */
  private clearRefreshCookie(response: Response): void {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    response.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/api/v1/auth',
    });
  }
}
