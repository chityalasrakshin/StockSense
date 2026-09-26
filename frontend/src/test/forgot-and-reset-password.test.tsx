import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from './test-utils';
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form';
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form';
import * as authApi from '@/features/auth/api';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams('email=resetuser@stocksense.dev'),
}));

describe('Forgot & Reset Password OTP Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ForgotPasswordForm', () => {
    it('renders email input and sends OTP request', async () => {
      const requestOtpSpy = vi
        .spyOn(authApi, 'requestOtp')
        .mockResolvedValueOnce({ message: 'OTP code sent' });

      renderWithProviders(<ForgotPasswordForm />);

      const emailInput = screen.getByLabelText(/account email/i);
      fireEvent.change(emailInput, { target: { value: 'manager@stocksense.dev' } });

      const submitBtn = screen.getByRole('button', { name: /send verification code/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(requestOtpSpy).toHaveBeenCalledWith('manager@stocksense.dev');
        expect(screen.getByText(/verification code sent/i)).toBeInTheDocument();
        expect(screen.getByText(/check the backend terminal output/i)).toBeInTheDocument();
      });
    });

    it('displays error if requestOtp fails', async () => {
      vi.spyOn(authApi, 'requestOtp').mockRejectedValueOnce(
        new Error('Too many requests. Please wait 5 minutes.'),
      );

      renderWithProviders(<ForgotPasswordForm />);

      const emailInput = screen.getByLabelText(/account email/i);
      fireEvent.change(emailInput, { target: { value: 'manager@stocksense.dev' } });

      const submitBtn = screen.getByRole('button', { name: /send verification code/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/too many requests/i);
      });
    });
  });

  describe('ResetPasswordForm', () => {
    it('pre-fills email from search params and submits 6-digit OTP to reset password', async () => {
      const verifyResetSpy = vi
        .spyOn(authApi, 'verifyOtpReset')
        .mockResolvedValueOnce({ message: 'Password reset successfully' });

      renderWithProviders(<ResetPasswordForm />);

      const emailInput = screen.getByLabelText(/account email/i) as HTMLInputElement;
      expect(emailInput.value).toBe('resetuser@stocksense.dev');

      const otpInput = screen.getByLabelText(/6-digit verification code/i);
      fireEvent.change(otpInput, { target: { value: '123456' } });

      const newPasswordInput = screen.getByLabelText(/^new password/i);
      const confirmInput = screen.getByLabelText(/confirm new password/i);

      fireEvent.change(newPasswordInput, { target: { value: 'NewPassword123!' } });
      fireEvent.change(confirmInput, { target: { value: 'NewPassword123!' } });

      const submitBtn = screen.getByRole('button', { name: /verify otp & reset password/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(verifyResetSpy).toHaveBeenCalledWith({
          email: 'resetuser@stocksense.dev',
          otp: '123456',
          newPassword: 'NewPassword123!',
        });
        expect(screen.getByText(/password reset complete/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /proceed to sign in/i })).toBeInTheDocument();
      });
    });

    it('rejects passwords shorter than 8 characters', async () => {
      renderWithProviders(<ResetPasswordForm />);

      const otpInput = screen.getByLabelText(/6-digit verification code/i);
      fireEvent.change(otpInput, { target: { value: '123456' } });

      const newPasswordInput = screen.getByLabelText(/^new password/i);
      const confirmInput = screen.getByLabelText(/confirm new password/i);

      fireEvent.change(newPasswordInput, { target: { value: 'short' } });
      fireEvent.change(confirmInput, { target: { value: 'short' } });

      const submitBtn = screen.getByRole('button', { name: /verify otp & reset password/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/at least 8 characters/i);
      });
    });
  });
});
