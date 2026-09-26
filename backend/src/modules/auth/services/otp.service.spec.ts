import { HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { OtpProducerService } from './otp-producer.service';
import { OtpService, OTP_EXPIRATION_MINUTES } from './otp.service';

describe('OtpService', () => {
  let service: OtpService;
  let prisma: any;
  let emailService: any;
  let otpProducerService: any;

  const mockUser = {
    id: 'user-uuid-123',
    email: 'test@stocksense.dev',
    isActive: true,
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      otpCode: {
        count: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    emailService = {
      sendPasswordResetOtp: jest.fn().mockResolvedValue(undefined),
    };

    otpProducerService = {
      enqueueOtpEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: emailService },
        { provide: OtpProducerService, useValue: otpProducerService },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
  });

  describe('generateNumericOtp', () => {
    it('should generate a 6-digit numeric OTP', () => {
      const otp = service.generateNumericOtp();
      expect(otp).toHaveLength(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
    });
  });

  describe('hashOtp and verifyOtpHash', () => {
    it('should hash the OTP using bcrypt and correctly verify matching code', async () => {
      const rawOtp = '123456';
      const hash = await service.hashOtp(rawOtp);

      expect(hash).not.toBe(rawOtp);
      expect(hash.startsWith('$2')).toBe(true); // bcrypt prefix

      const isMatch = await service.verifyOtpHash(rawOtp, hash);
      expect(isMatch).toBe(true);

      const isWrongMatch = await service.verifyOtpHash('654321', hash);
      expect(isWrongMatch).toBe(false);
    });
  });

  describe('requestPasswordResetOtp', () => {
    it('should hash OTP at rest, set 10-min TTL, invalidate previous OTPs, and send email', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.otpCode.count.mockResolvedValue(0);
      prisma.otpCode.updateMany.mockResolvedValue({ count: 1 });
      prisma.otpCode.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'otp-id-1', ...data }),
      );

      const result = await service.requestPasswordResetOtp(mockUser.email);

      expect(result.message).toContain('password reset code has been sent');
      expect(prisma.otpCode.updateMany).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          purpose: 'PASSWORD_RESET',
          consumedAt: null,
        },
        data: {
          consumedAt: expect.any(Date),
        },
      });

      expect(prisma.otpCode.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          codeHash: expect.any(String),
          purpose: 'PASSWORD_RESET',
          expiresAt: expect.any(Date),
        },
      });

      // Verify that codeHash is a bcrypt hash and NEVER plaintext
      const createCall = prisma.otpCode.create.mock.calls[0][0];
      const savedHash = createCall.data.codeHash;
      expect(savedHash.startsWith('$2')).toBe(true);
      expect(savedHash).not.toMatch(/^\d{6}$/);

      // Verify expiration is ~10 minutes in the future
      const expiresAt = createCall.data.expiresAt;
      const expectedMinExpiry = new Date(Date.now() + (OTP_EXPIRATION_MINUTES - 1) * 60 * 1000);
      expect(expiresAt.getTime()).toBeGreaterThan(expectedMinExpiry.getTime());

      // Verify email was dispatched asynchronously via OtpProducerService
      expect(otpProducerService.enqueueOtpEmail).toHaveBeenCalledWith({
        email: mockUser.email,
        otp: expect.stringMatching(/^\d{6}$/),
        ttlMinutes: OTP_EXPIRATION_MINUTES,
      });
    });

    it('should return generic success message if user does not exist (prevent enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.requestPasswordResetOtp('nonexistent@stocksense.dev');
      expect(result.message).toContain('password reset code has been sent');
      expect(prisma.otpCode.create).not.toHaveBeenCalled();
      expect(otpProducerService.enqueueOtpEmail).not.toHaveBeenCalled();
    });

    it('should throw 429 Too Many Requests if rate limit window is exceeded', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.otpCode.count.mockResolvedValue(3); // 3 requests already made in window

      await expect(service.requestPasswordResetOtp(mockUser.email)).rejects.toThrow(
        new HttpException(
          'Too many OTP requests. Please wait 5 minutes before requesting another code.',
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );

      expect(prisma.otpCode.create).not.toHaveBeenCalled();
    });
  });

  describe('verifyAndConsumeOtp (Single-use & Expiry Logic)', () => {
    it('should verify matching OTP and mark it consumed immediately (single-use invariant)', async () => {
      const rawOtp = '789123';
      const hash = await bcrypt.hash(rawOtp, 10);

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.otpCode.findMany.mockResolvedValue([
        {
          id: 'otp-record-1',
          userId: mockUser.id,
          codeHash: hash,
          purpose: 'PASSWORD_RESET',
          consumedAt: null,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      ]);
      prisma.otpCode.update.mockResolvedValue({ id: 'otp-record-1', consumedAt: new Date() });

      const result = await service.verifyAndConsumeOtp(mockUser.email, rawOtp);

      expect(result).toEqual({ userId: mockUser.id });
      expect(prisma.otpCode.update).toHaveBeenCalledWith({
        where: { id: 'otp-record-1' },
        data: { consumedAt: expect.any(Date) },
      });
    });

    it('should reject already consumed or non-existent active OTPs', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      // No active unconsumed OTPs returned
      prisma.otpCode.findMany.mockResolvedValue([]);

      await expect(service.verifyAndConsumeOtp(mockUser.email, '123456')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.otpCode.update).not.toHaveBeenCalled();
    });

    it('should reject incorrect OTP code attempt', async () => {
      const correctHash = await bcrypt.hash('111111', 10);

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.otpCode.findMany.mockResolvedValue([
        {
          id: 'otp-record-1',
          userId: mockUser.id,
          codeHash: correctHash,
          purpose: 'PASSWORD_RESET',
          consumedAt: null,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      ]);

      await expect(service.verifyAndConsumeOtp(mockUser.email, '999999')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.otpCode.update).not.toHaveBeenCalled();
    });
  });
});
