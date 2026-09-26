import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Role } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;
  let configService: any;
  let otpService: any;

  const mockResponse: any = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  };

  const mockUser = {
    id: 'user-id-123',
    email: 'manager@stocksense.dev',
    passwordHash: '',
    role: Role.INVENTORY_MANAGER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    mockUser.passwordHash = await bcrypt.hash('validPassword123', 10);
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock.jwt.access.token'),
    };

    configService = {
      get: jest.fn((key: string, defaultVal: any) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'JWT_EXPIRATION') return '15m';
        return defaultVal;
      }),
    };

    otpService = {
      verifyAndConsumeOtp: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: OtpService, useValue: otpService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('signup', () => {
    it('should create new user, hash password, create session family, and set cookie', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });

      const result = await service.signup(
        { email: 'new@stocksense.dev', password: 'NewSecurePassword123' },
        mockResponse,
      );

      expect(result.accessToken).toBe('mock.jwt.access.token');
      expect(result.user.email).toBe(mockUser.email);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        expect.any(String),
        expect.objectContaining({ httpOnly: true }),
      );
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUser.id,
          family: expect.any(String),
          isRevoked: false,
        }),
      });
    });

    it('should throw ConflictException if email is already in use', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.signup({ email: mockUser.email, password: 'AnyPassword123' }, mockResponse),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should validate credentials, establish new refresh token family, and set cookie', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });

      const result = await service.login(
        { email: mockUser.email, password: 'validPassword123' },
        mockResponse,
      );

      expect(result.accessToken).toBe('mock.jwt.access.token');
      expect(mockResponse.cookie).toHaveBeenCalled();
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUser.id,
          isRevoked: false,
        }),
      });
    });

    it('should reject invalid password with UnauthorizedException', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.login({ email: mockUser.email, password: 'wrongPassword' }, mockResponse),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens (Rotation and Reuse Detection)', () => {
    it('should rotate valid refresh token: revoke current token and create new token with same family', async () => {
      const rawToken = 'plain-refresh-token-123';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const familyId = 'family-uuid-abc';

      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-rec-1',
        userId: mockUser.id,
        tokenHash,
        family: familyId,
        isRevoked: false,
        expiresAt: new Date(Date.now() + 1000000),
        user: mockUser,
      });
      prisma.refreshToken.update.mockResolvedValue({ id: 'token-rec-1', isRevoked: true });
      prisma.refreshToken.create.mockResolvedValue({ id: 'token-rec-2' });

      const result = await service.refreshTokens(rawToken, mockResponse);

      expect(result.accessToken).toBe('mock.jwt.access.token');

      // Old token must be marked isRevoked = true
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'token-rec-1' },
        data: { isRevoked: true },
      });

      // New token must preserve the same session family
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUser.id,
          family: familyId,
          isRevoked: false,
        }),
      });

      // New rotating refresh token placed in cookie
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        expect.any(String),
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('REUSE DETECTION: Reusing an old/revoked token must revoke the entire token family and throw 401', async () => {
      const rawToken = 'replayed-old-token';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const compromisedFamily = 'compromised-family-uuid-999';

      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'old-token-rec',
        userId: mockUser.id,
        tokenHash,
        family: compromisedFamily,
        isRevoked: true, // Already consumed / revoked!
        expiresAt: new Date(Date.now() + 1000000),
        user: mockUser,
      });

      await expect(service.refreshTokens(rawToken, mockResponse)).rejects.toThrow(
        new UnauthorizedException('Refresh token reuse detected. Session family has been revoked.'),
      );

      // Invariant: Entire family must be revoked
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { family: compromisedFamily },
        data: { isRevoked: true },
      });

      // Invariant: Cookie must be cleared
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refreshToken', expect.any(Object));

      // No new token created
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('should reject expired refresh token', async () => {
      const rawToken = 'expired-token';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-rec-expired',
        tokenHash,
        family: 'family-1',
        isRevoked: false,
        expiresAt: new Date(Date.now() - 10000), // in the past
        user: mockUser,
      });

      await expect(service.refreshTokens(rawToken, mockResponse)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockResponse.clearCookie).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should revoke session family and clear cookie', async () => {
      const rawToken = 'logout-token';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const family = 'logout-family-123';

      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-1',
        tokenHash,
        family,
      });

      const result = await service.logout(rawToken, mockResponse);

      expect(result.message).toBe('Logged out successfully');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { family },
        data: { isRevoked: true },
      });
      expect(mockResponse.clearCookie).toHaveBeenCalled();
    });
  });

  describe('verifyResetPassword', () => {
    it('should verify OTP, update user passwordHash, and revoke existing sessions', async () => {
      otpService.verifyAndConsumeOtp.mockResolvedValue({ userId: mockUser.id });
      prisma.user.update.mockResolvedValue(mockUser);
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.verifyResetPassword({
        email: mockUser.email,
        otp: '654321',
        newPassword: 'BrandNewPassword2026!',
      });

      expect(result.message).toContain('Password has been reset successfully');
      expect(otpService.verifyAndConsumeOtp).toHaveBeenCalledWith(
        mockUser.email,
        '654321',
        'PASSWORD_RESET',
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { passwordHash: expect.any(String) },
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        data: { isRevoked: true },
      });
    });
  });
});
