import { queryOptions } from '@tanstack/react-query';
import { getLedger } from './service';
import type { LedgerFilters } from './service';

export const ledgerKeys = {
  all: ['ledger'] as const,
  list: (filters: LedgerFilters) => [...ledgerKeys.all, 'list', filters] as const,
};

export const ledgerQueryOptions = (filters: LedgerFilters) =>
  queryOptions({
    queryKey: ledgerKeys.list(filters),
    queryFn: () => getLedger(filters),
  });
