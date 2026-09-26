'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDashboardKpis, DashboardKpis } from '../api';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PackageCheck,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

interface KpiCardsProps {
  initialData?: DashboardKpis;
}

export function KpiCards({ initialData }: KpiCardsProps) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: getDashboardKpis,
    initialData,
    refetchInterval: 30000,
  });

  if (isLoading && !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-36" />
          </Card>
        ))}
      </div>
    );
  }

  if (isError && !data) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <p className="font-semibold">Failed to load dashboard KPIs</p>
        <p className="text-xs text-muted-foreground mt-1">
          {error instanceof Error ? error.message : 'Unable to connect to KPI aggregation service'}
        </p>
      </div>
    );
  }

  const kpis = data || {
    totalProductsInStock: 0,
    totalProducts: 0,
    lowStockItems: 0,
    lowStockOrOutOfStockItems: 0,
    pendingReceipts: 0,
    pendingDeliveries: 0,
    internalTransfersScheduled: 0,
    internalTransfersCount: 0,
    recentLedgerActivity: 0,
  };

  const cards = [
    {
      id: 'kpi-total-in-stock',
      label: 'Total Products in Stock',
      value: kpis.totalProductsInStock ?? kpis.totalProducts,
      subtext: 'Products with positive stock balance',
      icon: PackageCheck,
      color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 dark:text-indigo-400',
      badge: 'In Stock',
      badgeColor: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
      href: '/dashboard/products',
    },
    {
      id: 'kpi-low-stock',
      label: 'Low Stock / Out of Stock',
      value: kpis.lowStockOrOutOfStockItems ?? kpis.lowStockItems,
      subtext: 'Items at or below reorder threshold',
      icon: AlertTriangle,
      color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-400',
      badge: (kpis.lowStockOrOutOfStockItems ?? kpis.lowStockItems) > 0 ? 'Attention' : 'Healthy',
      badgeColor:
        (kpis.lowStockOrOutOfStockItems ?? kpis.lowStockItems) > 0
          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      href: '/dashboard/products?stock=low',
    },
    {
      id: 'kpi-pending-receipts',
      label: 'Pending Receipts',
      value: kpis.pendingReceipts,
      subtext: 'Incoming supplier shipments',
      icon: ArrowDownLeft,
      color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/50 dark:text-teal-400',
      badge: 'Draft / Waiting',
      badgeColor: 'bg-teal-500/10 text-teal-700 dark:text-teal-300',
      href: '/dashboard/receipts',
    },
    {
      id: 'kpi-pending-deliveries',
      label: 'Pending Deliveries',
      value: kpis.pendingDeliveries,
      subtext: 'Outgoing customer orders',
      icon: ArrowUpRight,
      color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-400',
      badge: 'To Dispatch',
      badgeColor: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
      href: '/dashboard/deliveries',
    },
    {
      id: 'kpi-internal-transfers',
      label: 'Internal Transfers Scheduled',
      value: kpis.internalTransfersScheduled ?? kpis.internalTransfersCount,
      subtext: 'Inter-warehouse moves',
      icon: ArrowLeftRight,
      color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/50 dark:text-purple-400',
      badge: 'Scheduled',
      badgeColor: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
      href: '/dashboard/transfers',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.id}
            data-testid={card.id}
            className="group relative overflow-hidden rounded-xl border border-border/70 bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <span className="text-xs font-medium text-muted-foreground leading-snug">
                {card.label}
              </span>
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${card.color}`}
              >
                <Icon className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span
                data-testid={`${card.id}-value`}
                className="text-2xl font-bold tracking-tight text-foreground"
              >
                {card.value}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${card.badgeColor}`}>
                {card.badge}
              </span>
            </div>

            <p className="mt-1 text-[11px] text-muted-foreground leading-tight">{card.subtext}</p>

            <Link
              href={card.href}
              className="mt-3 flex items-center text-[11px] font-semibold text-primary opacity-80 group-hover:opacity-100 group-hover:underline"
            >
              View details <ChevronRight className="h-3 w-3 ml-0.5" />
            </Link>
          </Card>
        );
      })}
    </div>
  );
}
