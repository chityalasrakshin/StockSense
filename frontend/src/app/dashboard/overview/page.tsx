'use client';

import React, { Suspense } from 'react';
import PageContainer from '@/components/layout/page-container';
import { KpiCards } from '@/features/dashboard/components/kpi-cards';
import { DynamicFiltersBar } from '@/features/dashboard/components/dynamic-filters-bar';
import { DashboardDocumentsTable } from '@/features/dashboard/components/dashboard-documents-table';
import { Button } from '@/components/ui/button';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from 'lucide-react';
import Link from 'next/link';

export default function OverviewPage() {
  return (
    <PageContainer>
      <div className="min-h-full space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Dashboard Header */}
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1">
              <span>Workspace</span>
              <span>/</span>
              <span className="text-primary font-semibold">Inventory Overview</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Operations &amp; Stock Overview
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Real-time ledger counts, stock reorder alerts, and pending document movements across all warehouses.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/receipts">
              <Button size="sm" variant="outline" className="text-xs h-9 gap-1.5">
                <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" />
                Receive Stock
              </Button>
            </Link>
            <Link href="/dashboard/deliveries">
              <Button size="sm" variant="outline" className="text-xs h-9 gap-1.5">
                <ArrowUpRight className="h-3.5 w-3.5 text-blue-600" />
                Dispatch Delivery
              </Button>
            </Link>
            <Link href="/dashboard/transfers">
              <Button size="sm" className="text-xs h-9 gap-1.5">
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Internal Transfer
              </Button>
            </Link>
          </div>
        </header>

        {/* 1. Core Real KPI Cards (Wired to GET /dashboard/kpis) */}
        <section aria-label="Core Operational KPIs">
          <KpiCards />
        </section>

        {/* 2. Dynamic Filter Bar (Wired to GET /dashboard/filters-metadata + nuqs) */}
        <section aria-label="Dynamic Document Filters">
          <Suspense fallback={<div className="h-24 rounded-xl border bg-card/50 animate-pulse" />}>
            <DynamicFiltersBar />
          </Suspense>
        </section>

        {/* 3. Filtered Operational Document Flow (Wired to GET /documents with active filters) */}
        <section aria-label="Operational Documents Flow">
          <Suspense fallback={<div className="h-64 rounded-xl border bg-card/50 animate-pulse" />}>
            <DashboardDocumentsTable />
          </Suspense>
        </section>
      </div>
    </PageContainer>
  );
}
