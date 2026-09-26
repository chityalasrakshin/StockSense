'use client';

import React, { useState } from 'react';
import { useAuth } from '../context/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApiError } from '@/lib/api-client';
import { Icons } from '@/components/icons';
import { formatDate } from '@/lib/format';

export function ProfileView() {
  const { user, role, updateProfile, logout } = useAuth();

  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  React.useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password && password.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }

    const payload: { email?: string; password?: string } = {};
    if (email.trim() && email !== user?.email) {
      payload.email = email.trim();
    }
    if (password.trim()) {
      payload.password = password.trim();
    }

    if (Object.keys(payload).length === 0) {
      setSuccess('No changes to save.');
      return;
    }

    setLoading(true);

    try {
      await updateProfile(payload);
      setPassword('');
      setConfirmPassword('');
      setSuccess('Profile updated successfully.');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to update profile.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <p className="text-sm text-muted-foreground">
          View your account credentials, role assignments, and update your personal security settings.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2"
        >
          <Icons.warning className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-lg border border-emerald-500/50 bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 flex items-start gap-2"
        >
          <Icons.check className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Card */}
        <Card className="md:col-span-1">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-2xl mb-2">
              {user?.email?.slice(0, 2).toUpperCase() || 'US'}
            </div>
            <CardTitle className="text-base truncate">{user?.email || 'User'}</CardTitle>
            <CardDescription className="flex justify-center mt-1">
              <Badge variant={role === 'INVENTORY_MANAGER' ? 'default' : 'secondary'}>
                {role === 'INVENTORY_MANAGER' ? 'Inventory Manager' : 'Warehouse Staff'}
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs pt-2">
            <div className="flex justify-between py-1 border-b">
              <span className="text-muted-foreground">Account Status</span>
              <span className="font-medium text-emerald-600 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Active
              </span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-muted-foreground">Member Since</span>
              <span className="font-medium">
                {user?.createdAt ? formatDate(new Date(user.createdAt)) : 'Today'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-muted-foreground">System ID</span>
              <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[120px]">
                {user?.id || '—'}
              </span>
            </div>
            <div className="pt-2">
              <Button
                variant="destructive"
                className="w-full text-xs"
                onClick={() => logout()}
              >
                <Icons.logout className="mr-2 h-3.5 w-3.5" />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Edit Profile Form */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
            <CardDescription>
              Modify your registered email address or set a new password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profile-email">Email Address</Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                    setSuccess(null);
                  }}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-role">Current Role</Label>
                <Input
                  id="profile-role"
                  type="text"
                  value={
                    role === 'INVENTORY_MANAGER'
                      ? 'Inventory Manager (Full administrative control)'
                      : 'Warehouse Staff (Operations & Movement Execution)'
                  }
                  disabled
                  className="bg-muted text-muted-foreground cursor-not-allowed"
                />
                <p className="text-[11px] text-muted-foreground">
                  Roles are assigned according to the RBAC authorization policy.
                </p>
              </div>

              <div className="pt-2 border-t space-y-4">
                <p className="text-xs font-semibold text-foreground">Change Password (Optional)</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="profile-new-password">New Password</Label>
                    <Input
                      id="profile-new-password"
                      type="password"
                      placeholder="Leave blank to keep current"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError(null);
                        setSuccess(null);
                      }}
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="profile-confirm-password">Confirm New Password</Label>
                    <Input
                      id="profile-confirm-password"
                      type="password"
                      placeholder="Repeat new password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setError(null);
                        setSuccess(null);
                      }}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Icons.spinner className="h-4 w-4 animate-spin" />
                      Saving changes...
                    </span>
                  ) : (
                    'Save Profile Changes'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
