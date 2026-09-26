import { EmailOtpService } from '../services/email-otp.service';

describe('Email OTP Worker & Service', () => {
  it('should dispatch password reset email via swappable provider interface', async () => {
    const mockEmailService: any = {
      sendPasswordResetOtp: jest.fn().mockResolvedValue(undefined),
    };

    const service = new EmailOtpService(mockEmailService);

    await service.processEmailOtp({
      email: 'staff@stocksense.dev',
      otp: '654321',
      ttlMinutes: 10,
    });

    expect(mockEmailService.sendPasswordResetOtp).toHaveBeenCalledWith(
      'staff@stocksense.dev',
      '654321',
      10,
    );
  });
});
