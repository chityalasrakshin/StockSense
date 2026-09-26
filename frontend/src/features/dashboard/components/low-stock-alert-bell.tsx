'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDashboardAlerts, LowStockAlertItem } from '../api';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { Bell } from 'lucide-react';
import Link from 'next/link';

export function LowStockAlertBell() {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'alerts', 'OPEN'],
    queryFn: () => getDashboardAlerts({ status: 'OPEN', limit: 10 }),
    refetchInterval: 30000, // Polling every 30 seconds
  });

  const alerts: LowStockAlertItem[] = data?.items || [];
  const count = alerts.length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 rounded-lg"
            aria-label={`Low-stock alerts: ${count} open`}
            id="low-stock-alert-bell"
          >
            <Bell className="h-5 w-5 text-muted-foreground" />
            {count > 0 && (
              <span
                data-testid="alert-badge"
                className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground animate-in zoom-in-50"
              >
                {count}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent className="w-80 sm:w-96" align="end" sideOffset={8}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between py-2">
            <span className="font-semibold text-sm">Low Stock Alerts</span>
            <Badge variant={count > 0 ? 'destructive' : 'secondary'} className="text-[10px]">
              {count > 0 ? `${count} Action Required` : 'Healthy'}
            </Badge>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        {isLoading ? (
          <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Icons.spinner className="h-4 w-4 animate-spin" /> Checking inventory levels...
          </div>
        ) : count === 0 ? (
          <div className="py-6 px-4 text-center space-y-1">
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50">
              <Icons.check className="h-4 w-4" />
            </div>
            <p className="text-xs font-medium text-foreground">All stock levels healthy</p>
            <p className="text-[11px] text-muted-foreground">
              No products are currently at or below their reorder threshold.
            </p>
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto divide-y divide-border/50">
            {alerts.map((alert) => (
              <DropdownMenuItem
                key={alert.id}
                className="flex flex-col items-start gap-1 p-3 cursor-pointer focus:bg-muted/60"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-semibold text-xs tracking-tight text-foreground truncate max-w-[180px]">
                    {alert.product?.name || alert.productId}
                  </span>
                  <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 font-mono">
                    {alert.product?.sku}
                  </Badge>
                </div>
                <div className="flex w-full items-center justify-between text-[11px] text-muted-foreground">
                  <span>Loc: {alert.location?.name || alert.locationId}</span>
                  <span className="font-medium text-destructive">
                    Stock: {alert.currentStock} (Reorder: {alert.reorderPoint})
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}

        {count > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Link href="/dashboard/receipts" className="w-full block">
                <Button size="sm" variant="outline" className="w-full text-xs">
                  Create Stock Receipt
                </Button>
              </Link>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
