'use client';

/**
 * MoveHistoryTable — filterable audit trail of all stock movements.
 * Wired to GET /ledger with product, location, and date range filters.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, CalendarRange, ArrowUpCircle, ArrowDownCircle, MinusCircle, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { LedgerFilters } from '../api/service';
import { ledgerQueryOptions } from '../api/queries';

const DOCTYPE_BADGE: Record<string, string> = {
  RECEIPT: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  DELIVERY: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  TRANSFER: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  ADJUSTMENT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
};

export function MoveHistoryTable() {
  const [filters, setFilters] = useState<LedgerFilters>({ page: 1, limit: 25 });

  const { data, isLoading, isFetching } = useQuery({
    ...ledgerQueryOptions(filters),
    refetchInterval: 30_000,
  });

  const entries = data?.items ?? [];
  const meta = data?.meta;

  const handleFilterChange = (patch: Partial<LedgerFilters>) =>
    setFilters((f) => ({ ...f, ...patch, page: 1 }));

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 rounded-lg border p-3 bg-muted/10">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="ledger-filter-product"
            placeholder="Product name / SKU…"
            className="pl-8 text-xs h-9"
            value={filters.product ?? ''}
            onChange={(e) => handleFilterChange({ product: e.target.value || undefined })}
          />
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="ledger-filter-location"
            placeholder="Location name / code…"
            className="pl-8 text-xs h-9"
            value={filters.location ?? ''}
            onChange={(e) => handleFilterChange({ location: e.target.value || undefined })}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <CalendarRange className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            id="ledger-filter-from"
            type="date"
            className="text-xs h-9"
            value={filters.from ? filters.from.slice(0, 10) : ''}
            onChange={(e) =>
              handleFilterChange({ from: e.target.value ? `${e.target.value}T00:00:00.000Z` : undefined })
            }
          />
        </div>
        <div className="flex items-center gap-1.5">
          <CalendarRange className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            id="ledger-filter-to"
            type="date"
            className="text-xs h-9"
            value={filters.to ? filters.to.slice(0, 10) : ''}
            onChange={(e) =>
              handleFilterChange({ to: e.target.value ? `${e.target.value}T23:59:59.999Z` : undefined })
            }
          />
        </div>
      </div>

      {/* Stats */}
      {meta && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {meta.totalItems.toLocaleString()} ledger entr{meta.totalItems !== 1 ? 'ies' : 'y'}
            {isFetching && <RefreshCw className="inline h-3 w-3 ml-1 animate-spin" />}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={!meta.page || meta.page <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
            >
              ← Prev
            </Button>
            <span className="px-2 py-1 text-xs">
              Page {meta.page} / {meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={!meta.page || meta.page >= meta.totalPages}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
            >
              Next →
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed p-10 text-sm text-muted-foreground">
          No ledger entries found. Validate a document to see stock movements appear here.
        </div>
      ) : (
        <ScrollArea className="max-h-[600px] rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0">
              <tr className="border-b text-muted-foreground">
                <th className="py-2.5 px-3 text-left font-semibold">Posted At</th>
                <th className="py-2.5 px-3 text-left font-semibold">Product</th>
                <th className="py-2.5 px-3 text-left font-semibold">Location</th>
                <th className="py-2.5 px-3 text-left font-semibold">Document</th>
                <th className="py-2.5 px-3 text-right font-semibold">Delta</th>
                <th className="py-2.5 px-3 text-right font-semibold">Balance After</th>
                <th className="py-2.5 px-3 text-left font-semibold">Actor</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isPositive = entry.qtyDelta > 0;
                const isNeutral = entry.qtyDelta === 0;
                return (
                  <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="py-2 px-3 text-muted-foreground whitespace-nowrap" data-testid={`ledger-posted-${entry.id}`}>
                      {new Date(entry.postedAt).toLocaleString()}
                    </td>
                    <td className="py-2 px-3">
                      <p className="font-medium">{entry.product?.name ?? entry.productId}</p>
                      {entry.product?.sku && (
                        <p className="text-[10px] text-muted-foreground font-mono">{entry.product.sku}</p>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <p>{entry.location?.name ?? entry.locationId}</p>
                      {entry.location?.shortCode && (
                        <p className="text-[10px] text-muted-foreground font-mono">[{entry.location.shortCode}]</p>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {entry.document ? (
                        <div>
                          <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${DOCTYPE_BADGE[entry.document.type] ?? ''}`}>
                            {entry.document.type}
                          </span>
                          <p className="font-mono text-[10px] mt-0.5">{entry.document.reference}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span
                        className={`inline-flex items-center gap-0.5 font-bold tabular-nums ${
                          isPositive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isNeutral
                              ? 'text-muted-foreground'
                              : 'text-red-600 dark:text-red-400'
                        }`}
                        data-testid={`ledger-delta-${entry.id}`}
                      >
                        {isPositive ? (
                          <ArrowUpCircle className="h-3.5 w-3.5" />
                        ) : isNeutral ? (
                          <MinusCircle className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDownCircle className="h-3.5 w-3.5" />
                        )}
                        {isPositive ? `+${entry.qtyDelta}` : entry.qtyDelta}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold" data-testid={`ledger-balance-${entry.id}`}>
                      {entry.balanceAfter}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground truncate max-w-[120px]">
                      {entry.actor?.email ?? entry.actorId}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </div>
  );
}
