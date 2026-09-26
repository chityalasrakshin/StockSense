import { apiClient } from '@/lib/api-client';

export interface LedgerProduct {
  id: string;
  sku: string;
  name: string;
}

export interface LedgerLocation {
  id: string;
  shortCode: string;
  name: string;
  type: string;
}

export interface LedgerDocument {
  id: string;
  reference: string;
  type: string;
  status: string;
}

export interface LedgerActor {
  id: string;
  email: string;
  role: string;
}

export interface LedgerEntry {
  id: string;
  productId: string;
  locationId: string;
  documentId: string | null;
  qtyDelta: number;
  balanceAfter: number;
  postedAt: string;
  actorId: string;
  product?: LedgerProduct;
  location?: LedgerLocation;
  document?: LedgerDocument | null;
  actor?: LedgerActor;
}

export interface PaginatedLedger {
  items: LedgerEntry[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface LedgerFilters {
  product?: string;
  location?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export async function getLedger(filters: LedgerFilters = {}): Promise<PaginatedLedger> {
  try {
    const params = new URLSearchParams();
    if (filters.product) params.set('product', filters.product);
    if (filters.location) params.set('location', filters.location);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));

    const qs = params.toString();
    return await apiClient<PaginatedLedger>(`/ledger${qs ? `?${qs}` : ''}`);
  } catch {
    return { items: [], meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } };
  }
}
