import { Suspense } from 'react';
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'StockSense — Verify OTP & Reset Password',
};

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-muted/40">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">Verify & Reset</CardTitle>
          <CardDescription>
            Enter the 6-digit OTP code and choose your new password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="p-4 text-center text-sm text-muted-foreground">Loading form...</div>}>
            <ResetPasswordForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
