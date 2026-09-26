'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '../context/auth-context';
import { ApiError } from '@/lib/api-client';
import { Icons } from '@/components/icons';

export function SignupForm() {
  const router = useRouter();
  const { signup } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'INVENTORY_MANAGER' | 'WAREHOUSE_STAFF'>('WAREHOUSE_STAFF');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);

    try {
      const response = await signup({ email, password, confirmPassword, role });
      if (response.user.role === 'WAREHOUSE_STAFF') {
        router.push('/dashboard/receipts');
      } else {
        router.push('/dashboard/overview');
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

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
          <Label htmlFor="signup-email">Email</Label>
          <Input
            id="signup-email"
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
          <Label htmlFor="signup-role">Designated Role</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={role === 'WAREHOUSE_STAFF' ? 'default' : 'outline'}
              className="w-full text-xs h-9"
              onClick={() => setRole('WAREHOUSE_STAFF')}
            >
              Warehouse Staff
            </Button>
            <Button
              type="button"
              variant={role === 'INVENTORY_MANAGER' ? 'default' : 'outline'}
              className="w-full text-xs h-9"
              onClick={() => setRole('INVENTORY_MANAGER')}
            >
              Inventory Manager
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {role === 'WAREHOUSE_STAFF'
              ? 'Staff can execute operations (Receipts, Deliveries, Transfers) & view Move History.'
              : 'Managers have full access including Products, Warehouses settings, and the KPI Dashboard.'}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-password">Password</Label>
          <Input
            id="signup-password"
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            required
            autoComplete="new-password"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-confirm-password">Confirm Password</Label>
          <Input
            id="signup-confirm-password"
            type="password"
            placeholder="Repeat password"
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
              Creating account...
            </span>
          ) : (
            'Create Account'
          )}
        </Button>
      </form>

      <div className="text-center text-xs text-muted-foreground pt-2 border-t">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}
