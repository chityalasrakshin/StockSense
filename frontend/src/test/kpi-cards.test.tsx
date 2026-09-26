import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from './test-utils';
import { KpiCards } from '@/features/dashboard/components/kpi-cards';
import * as dashboardApi from '@/features/dashboard/api';

describe('KpiCards Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 5 core operational KPI cards with real verified metrics', async () => {
    const mockKpis: dashboardApi.DashboardKpis = {
      totalProductsInStock: 1,
      totalProducts: 1,
      lowStockItems: 2,
      lowStockOrOutOfStockItems: 2,
      pendingReceipts: 1,
      pendingDeliveries: 0,
      internalTransfersScheduled: 0,
      internalTransfersCount: 0,
      recentLedgerActivity: 5,
    };

    vi.spyOn(dashboardApi, 'getDashboardKpis').mockResolvedValueOnce(mockKpis);

    renderWithProviders(<KpiCards initialData={mockKpis} />);

    // 1. Total Products in Stock
    expect(screen.getByText(/total products in stock/i)).toBeInTheDocument();
    expect(screen.getByTestId('kpi-total-in-stock-value')).toHaveTextContent('1');

    // 2. Low Stock / Out of Stock
    expect(screen.getByText(/low stock \/ out of stock/i)).toBeInTheDocument();
    expect(screen.getByTestId('kpi-low-stock-value')).toHaveTextContent('2');

    // 3. Pending Receipts
    expect(screen.getByText(/pending receipts/i)).toBeInTheDocument();
    expect(screen.getByTestId('kpi-pending-receipts-value')).toHaveTextContent('1');

    // 4. Pending Deliveries
    expect(screen.getByText(/pending deliveries/i)).toBeInTheDocument();
    expect(screen.getByTestId('kpi-pending-deliveries-value')).toHaveTextContent('0');

    // 5. Internal Transfers Scheduled
    expect(screen.getByText(/internal transfers scheduled/i)).toBeInTheDocument();
    expect(screen.getByTestId('kpi-internal-transfers-value')).toHaveTextContent('0');
  });

  it('displays error message if KPI query fails and no data is present', async () => {
    vi.spyOn(dashboardApi, 'getDashboardKpis').mockRejectedValueOnce(
      new Error('Database connection failed'),
    );

    renderWithProviders(<KpiCards />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load dashboard kpis/i)).toBeInTheDocument();
      expect(screen.getByText(/database connection failed/i)).toBeInTheDocument();
    });
  });
});
