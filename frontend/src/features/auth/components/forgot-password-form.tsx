'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { requestOtp } from '../api';
import { ApiError } from '@/lib/api-client';
import { Icons } from '@/components/icons';

export function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dispatched, setDispatched] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await requestOtp(email);
      setDispatched(true);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to request reset OTP. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (dispatched) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50">
          <Icons.check className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-foreground">Verification Code Sent</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            If an active account exists for <span className="font-semibold text-foreground">{email}</span>, a 6-digit OTP verification code has been dispatched.
          </p>
          <div className="rounded-lg border border-amber-500/20 bg-amber-50/50 p-2.5 text-[11px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 text-left">
            <strong>Development Notice:</strong> In dev mode, check the backend terminal output for the OTP code (logged as <code>[OtpService] DEV-ONLY: Generated 6-digit OTP...</code>).
          </div>
        </div>
        <Button
          type="button"
          className="w-full"
          onClick={() => router.push(`/reset-password?email=${encodeURIComponent(email)}`)}
        >
          Enter 6-Digit OTP & Reset Password
        </Button>
        <div className="text-xs text-muted-foreground pt-2">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to Sign in
          </Link>
        </div>
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
          <Label htmlFor="forgot-email">Account Email</Label>
          <Input
            id="forgot-email"
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

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <span className="flex items-center gap-2">
              <Icons.spinner className="h-4 w-4 animate-spin" />
              Requesting code...
            </span>
          ) : (
            'Send Verification Code'
          )}
        </Button>
      </form>

      <div className="text-center text-xs text-muted-foreground pt-2 border-t">
        Remembered your password?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}
