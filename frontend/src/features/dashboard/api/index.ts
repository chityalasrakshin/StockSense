import { apiClient } from '@/lib/api-client';

export interface DashboardKpis {
  totalProducts: number;
  lowStockItems: number;
  pendingReceipts: number;
  pendingDeliveries: number;
  internalTransfersCount: number;
  recentLedgerActivity: number;
}

export async function getDashboardKpis(): Promise<DashboardKpis> {
  return apiClient<DashboardKpis>('/dashboard/kpis');
}
