import { apiClient } from '@/lib/api-client';

export interface DashboardKpis {
  totalProductsInStock: number;
  totalProducts: number;
  lowStockItems: number;
  lowStockOrOutOfStockItems: number;
  pendingReceipts: number;
  pendingDeliveries: number;
  internalTransfersScheduled: number;
  internalTransfersCount: number;
  recentLedgerActivity: number;
}

export interface FilterOption {
  label: string;
  value: string;
}

export interface WarehouseFilterOption {
  id: string;
  name: string;
  label: string;
  value: string;
  shortCode: string;
  type: string;
}

export interface CategoryFilterOption {
  id: string;
  name: string;
  label: string;
  value: string;
  parentId: string | null;
}

export interface FiltersMetadata {
  documentTypes: FilterOption[];
  statuses: FilterOption[];
  warehouses: WarehouseFilterOption[];
  categories: CategoryFilterOption[];
}

export interface ProductAlert {
  id: string;
  sku: string;
  name: string;
  unitCost: number;
}

export interface LocationAlert {
  id: string;
  name: string;
  shortCode: string;
}

export interface LowStockAlertItem {
  id: string;
  productId: string;
  locationId: string;
  currentStock: number;
  currentBalance: number;
  reorderPoint: number;
  status: 'OPEN' | 'RESOLVED';
  openedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  product: ProductAlert;
  location: LocationAlert;
}

export interface PaginatedAlerts {
  items: LowStockAlertItem[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface DocumentLineItem {
  id: string;
  productId: string;
  expectedQty: number;
  actualQty: number | null;
  product: {
    id: string;
    sku: string;
    name: string;
  };
}

export interface DocumentRecord {
  id: string;
  reference: string;
  type: 'RECEIPT' | 'DELIVERY' | 'TRANSFER' | 'ADJUSTMENT';
  status: 'DRAFT' | 'WAITING' | 'READY' | 'DONE' | 'CANCELED';
  sourceLocationId: string | null;
  destLocationId: string | null;
  contact: string | null;
  partnerRef: string | null;
  scheduleDate: string | null;
  createdAt: string;
  lines: DocumentLineItem[];
  sourceLocation?: { name: string; shortCode: string } | null;
  destLocation?: { name: string; shortCode: string } | null;
}

export interface PaginatedDocuments {
  items: DocumentRecord[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

export async function getDashboardKpis(): Promise<DashboardKpis> {
  return apiClient<DashboardKpis>('/dashboard/kpis');
}

export async function getFiltersMetadata(): Promise<FiltersMetadata> {
  return apiClient<FiltersMetadata>('/dashboard/filters-metadata');
}

export async function getDashboardAlerts(params?: {
  status?: 'OPEN' | 'RESOLVED';
  page?: number;
  limit?: number;
  search?: string;
}): Promise<PaginatedAlerts> {
  const query = new URLSearchParams();
  if (params?.status) query.append('status', params.status);
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));
  if (params?.search) query.append('search', params.search);

  const qs = query.toString();
  return apiClient<PaginatedAlerts>(`/dashboard/alerts${qs ? `?${qs}` : ''}`);
}

export async function getDocuments(params?: {
  type?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  warehouseId?: string;
  categoryId?: string;
}): Promise<PaginatedDocuments> {
  const query = new URLSearchParams();
  if (params?.type) query.append('type', params.type);
  if (params?.status) query.append('status', params.status);
  if (params?.search) query.append('search', params.search);
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));
  if (params?.warehouseId) query.append('warehouseId', params.warehouseId);
  if (params?.categoryId) query.append('categoryId', params.categoryId);

  const qs = query.toString();
  return apiClient<PaginatedDocuments>(`/documents${qs ? `?${qs}` : ''}`);
}
