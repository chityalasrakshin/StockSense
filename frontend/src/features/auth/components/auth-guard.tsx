'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../context/auth-context';
import { Icons } from '@/components/icons';

// Routes accessible to WAREHOUSE_STAFF
const STAFF_ALLOWED_PREFIXES = [
  '/dashboard/receipts',
  '/dashboard/deliveries',
  '/dashboard/transfers',
  '/dashboard/adjustments',
  '/dashboard/move-history',
  '/dashboard/profile',
];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, role } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    if (role === 'WAREHOUSE_STAFF') {
      const isAllowed = STAFF_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
      if (!isAllowed) {
        // Staff redirected away from Manager-only overview/products/settings to operations
        router.replace('/dashboard/receipts');
      }
    }
  }, [isAuthenticated, isLoading, role, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md animate-pulse">
            <Icons.product className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold tracking-tight">StockSense</p>
            <p className="text-xs text-muted-foreground">Verifying credentials and permissions...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Prevent flicker if staff is on restricted route while redirecting
  if (
    role === 'WAREHOUSE_STAFF' &&
    !STAFF_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return null;
  }

  return <>{children}</>;
}
