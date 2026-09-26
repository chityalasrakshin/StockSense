'use client';

/**
 * AdjustmentsGuard — client-side RBAC gate for the Stock Adjustments page.
 * WAREHOUSE_STAFF see a restricted-access message; INVENTORY_MANAGER get children.
 * The backend already 403s the API — this is defense-in-depth UI protection.
 */

import React from 'react';
import { useAuth } from '@/features/auth/context/auth-context';
import { ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AdjustmentsGuardProps {
  children: React.ReactNode;
}

export function AdjustmentsGuard({ children }: AdjustmentsGuardProps) {
  const { role, isLoading } = useAuth();

  if (isLoading) return null;

  if (role === 'WAREHOUSE_STAFF') {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive text-base">
            <ShieldAlert className="h-5 w-5" />
            Access Restricted
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Stock Adjustments are restricted to <strong>Inventory Managers</strong> only. If you
            believe you need access, contact your warehouse administrator.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Any attempt to create adjustments via the API will return HTTP 403.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
