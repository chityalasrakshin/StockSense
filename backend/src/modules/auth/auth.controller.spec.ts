import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { OtpService } from './services/otp.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: any;
  let otpService: any;

  const mockResponse: any = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  };

  const mockAuthResponse = {
    accessToken: 'mock.access.token',
    user: {
      id: 'user-1',
      email: 'manager@stocksense.dev',
      role: Role.INVENTORY_MANAGER,
      isActive: true,
      createdAt: new Date(),
    },
  };

  beforeEach(async () => {
    authService = {
      signup: jest.fn().mockResolvedValue(mockAuthResponse),
      login: jest.fn().mockResolvedValue(mockAuthResponse),
      refreshTokens: jest.fn().mockResolvedValue({ accessToken: 'new.access.token' }),
      logout: jest.fn().mockResolvedValue({ message: 'Logged out successfully' }),
      verifyResetPassword: jest
        .fn()
        .mockResolvedValue({ message: 'Password has been reset successfully' }),
    };

    otpService = {
      requestPasswordResetOtp: jest
        .fn()
        .mockResolvedValue({ message: 'Password reset code has been sent.' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: OtpService, useValue: otpService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('signup should invoke authService.signup', async () => {
    const dto = { email: 'test@stocksense.dev', password: 'Password123!' };
    const res = await controller.signup(dto, mockResponse);
    expect(res).toEqual(mockAuthResponse);
    expect(authService.signup).toHaveBeenCalledWith(dto, mockResponse);
  });

  it('login should invoke authService.login', async () => {
    const dto = { email: 'manager@stocksense.dev', password: 'adminPassword123' };
    const res = await controller.login(dto, mockResponse);
    expect(res).toEqual(mockAuthResponse);
    expect(authService.login).toHaveBeenCalledWith(dto, mockResponse);
  });

  it('refresh should extract token and invoke authService.refreshTokens', async () => {
    const req: any = { cookies: { refreshToken: 'cookie-token' } };
    const res = await controller.refresh(req, mockResponse, {});
    expect(res).toEqual({ accessToken: 'new.access.token' });
    expect(authService.refreshTokens).toHaveBeenCalledWith('cookie-token', mockResponse);
  });

  it('requestOtp should invoke otpService.requestPasswordResetOtp', async () => {
    const res = await controller.requestOtp({ email: 'user@stocksense.dev' });
    expect(res.message).toContain('Password reset code has been sent');
    expect(otpService.requestPasswordResetOtp).toHaveBeenCalledWith('user@stocksense.dev');
  });

  it('verifyReset should invoke authService.verifyResetPassword', async () => {
    const dto = {
      email: 'user@stocksense.dev',
      otp: '123456',
      newPassword: 'NewPassword123!',
    };
    const res = await controller.verifyReset(dto);
    expect(res.message).toContain('Password has been reset successfully');
    expect(authService.verifyResetPassword).toHaveBeenCalledWith(dto);
  });
});
