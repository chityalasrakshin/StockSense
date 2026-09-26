'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useQueryStates } from 'nuqs';
import { dashboardFilterParsers } from './dynamic-filters-bar';
import { getDocuments, DocumentRecord } from '../api';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  SlidersHorizontal,
  Inbox,
} from 'lucide-react';
import { formatDate } from '@/lib/format';
import Link from 'next/link';

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  RECEIPT: ArrowDownLeft,
  DELIVERY: ArrowUpRight,
  TRANSFER: ArrowLeftRight,
  ADJUSTMENT: SlidersHorizontal,
};

const typeColors: Record<string, string> = {
  RECEIPT: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  DELIVERY: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
  TRANSFER: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
  ADJUSTMENT: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
};

const statusStyles: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  WAITING: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  READY: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  DONE: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  CANCELED: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
};

export function DashboardDocumentsTable() {
  const [filters] = useQueryStates(dashboardFilterParsers);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [
      'documents',
      filters.type,
      filters.status,
      filters.warehouse,
      filters.category,
      filters.search,
    ],
    queryFn: () =>
      getDocuments({
        type: filters.type || undefined,
        status: filters.status || undefined,
        warehouseId: filters.warehouse || undefined,
        categoryId: filters.category || undefined,
        search: filters.search || undefined,
        limit: 10,
      }),
  });

  const documents: DocumentRecord[] = data?.items || [];

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Operational Document Flow</h2>
          <p className="text-xs text-muted-foreground">
            Real documents filtered by type, lifecycle status, warehouse, and product category.
          </p>
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          {isLoading ? 'Loading...' : `${documents.length} records`}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-[140px] text-xs">Reference</TableHead>
              <TableHead className="w-[120px] text-xs">Type</TableHead>
              <TableHead className="text-xs">Partner / Contact</TableHead>
              <TableHead className="text-xs">Location Route</TableHead>
              <TableHead className="text-xs">Lines / Items</TableHead>
              <TableHead className="w-[100px] text-xs">Status</TableHead>
              <TableHead className="w-[110px] text-xs">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [1, 2, 3, 4].map((i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-sm text-destructive">
                  Error loading documents: {error instanceof Error ? error.message : 'Unknown error'}
                </TableCell>
              </TableRow>
            ) : documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <Inbox className="h-6 w-6 text-muted-foreground/60" />
                    <p className="text-xs font-medium">No documents match the active filter criteria</p>
                    <p className="text-[11px] text-muted-foreground">
                      Try adjusting or resetting your dynamic filters above.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => {
                const Icon = typeIcons[doc.type] || ArrowDownLeft;
                const source = doc.sourceLocation?.name || '—';
                const dest = doc.destLocation?.name || '—';
                const locationRoute =
                  doc.type === 'TRANSFER'
                    ? `${source} → ${dest}`
                    : doc.type === 'RECEIPT'
                      ? `→ ${dest}`
                      : doc.type === 'DELIVERY'
                        ? `${source} →`
                        : `${source}`;

                const linesSummary = doc.lines?.length
                  ? doc.lines
                      .map(
                        (l) =>
                          `${l.product?.sku || 'Item'} (${l.actualQty ?? l.expectedQty})`,
                      )
                      .join(', ')
                  : '0 lines';

                return (
                  <TableRow key={doc.id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-xs font-semibold text-foreground">
                      <Link
                        href={`/dashboard/${
                          doc.type === 'RECEIPT'
                            ? 'receipts'
                            : doc.type === 'DELIVERY'
                              ? 'deliveries'
                              : doc.type === 'TRANSFER'
                                ? 'transfers'
                                : 'adjustments'
                        }`}
                        className="hover:underline text-primary"
                      >
                        {doc.reference}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] inline-flex items-center gap-1 font-semibold ${
                          typeColors[doc.type] || ''
                        }`}
                      >
                        <Icon className="h-3 w-3" />
                        {doc.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {doc.contact || doc.partnerRef || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {locationRoute}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[180px]">
                      {linesSummary}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          statusStyles[doc.status] || ''
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {doc.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(new Date(doc.createdAt))}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
