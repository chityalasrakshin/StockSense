'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { verifyOtpReset } from '../api';
import { ApiError } from '@/lib/api-client';
import { Icons } from '@/components/icons';

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = searchParams?.get('email') || '';

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (otp.trim().length !== 6) {
      setError('Please enter a valid 6-digit OTP code');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);

    try {
      await verifyOtpReset({
        email: email.trim(),
        otp: otp.trim(),
        newPassword,
      });
      setSuccess(true);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to verify OTP and reset password. Please verify the code.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50">
          <Icons.check className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-foreground">Password Reset Complete</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your account password has been successfully reset. You can now sign in with your new credentials.
          </p>
        </div>
        <Button
          type="button"
          className="w-full"
          onClick={() => router.push('/login')}
        >
          Proceed to Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2"
        >
          <Icons.warning className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reset-email">Account Email</Label>
          <Input
            id="reset-email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reset-otp">6-Digit Verification Code (OTP)</Label>
          <Input
            id="reset-otp"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            className="tracking-widest font-mono text-center text-lg"
            value={otp}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 6);
              setOtp(val);
              setError(null);
            }}
            required
          />
          <p className="text-[11px] text-muted-foreground">
            Enter the 6-digit code dispatched to your email or backend console.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reset-new-password">New Password</Label>
          <Input
            id="reset-new-password"
            type="password"
            placeholder="At least 8 characters"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setError(null);
            }}
            required
            autoComplete="new-password"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reset-confirm-password">Confirm New Password</Label>
          <Input
            id="reset-confirm-password"
            type="password"
            placeholder="Repeat new password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setError(null);
            }}
            required
            autoComplete="new-password"
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <span className="flex items-center gap-2">
              <Icons.spinner className="h-4 w-4 animate-spin" />
              Resetting password...
            </span>
          ) : (
            'Verify OTP & Reset Password'
          )}
        </Button>
      </form>

      <div className="text-center text-xs text-muted-foreground pt-2 border-t flex justify-between items-center">
        <Link href="/forgot-password" className="text-primary hover:underline">
          Request new OTP
        </Link>
        <Link href="/login" className="text-muted-foreground hover:underline">
          Cancel & Sign in
        </Link>
      </div>
    </div>
  );
}
