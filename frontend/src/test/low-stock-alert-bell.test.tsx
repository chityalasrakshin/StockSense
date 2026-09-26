import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from './test-utils';
import { LowStockAlertBell } from '@/features/dashboard/components/low-stock-alert-bell';
import * as dashboardApi from '@/features/dashboard/api';

describe('LowStockAlertBell Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders bell button and badge with open alerts count', async () => {
    const mockAlerts: dashboardApi.PaginatedAlerts = {
      items: [
        {
          id: 'alert-1',
          productId: 'prod-1',
          locationId: 'loc-1',
          currentStock: 0,
          currentBalance: 0,
          reorderPoint: 50,
          status: 'OPEN',
          openedAt: new Date().toISOString(),
          resolvedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          product: { id: 'prod-1', sku: 'BOLT-M12-100', name: 'M12 Hex Bolts', unitCost: 0.15 },
          location: { id: 'loc-1', name: 'Main Warehouse', shortCode: 'WH' },
        },
        {
          id: 'alert-2',
          productId: 'prod-2',
          locationId: 'loc-1',
          currentStock: 0,
          currentBalance: 0,
          reorderPoint: 10,
          status: 'OPEN',
          openedAt: new Date().toISOString(),
          resolvedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          product: { id: 'prod-2', sku: 'DESK-001', name: 'Office Desk', unitCost: 150 },
          location: { id: 'loc-1', name: 'Main Warehouse', shortCode: 'WH' },
        },
      ],
      meta: { page: 1, limit: 10, totalItems: 2, totalPages: 1 },
    };

    vi.spyOn(dashboardApi, 'getDashboardAlerts').mockResolvedValue(mockAlerts);

    renderWithProviders(<LowStockAlertBell />);

    await waitFor(() => {
      const badge = screen.getByTestId('alert-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('2');
    });

    const bellBtn = screen.getByRole('button', { name: /low-stock alerts: 2 open/i });
    expect(bellBtn).toBeInTheDocument();
    fireEvent.click(bellBtn);

    await waitFor(() => {
      expect(screen.getByText('M12 Hex Bolts')).toBeInTheDocument();
      expect(screen.getByText('Office Desk')).toBeInTheDocument();
      expect(screen.getByText('BOLT-M12-100')).toBeInTheDocument();
    });
  });

  it('renders healthy state when there are zero open alerts', async () => {
    vi.spyOn(dashboardApi, 'getDashboardAlerts').mockResolvedValue({
      items: [],
      meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
    });

    renderWithProviders(<LowStockAlertBell />);

    await waitFor(() => {
      expect(screen.queryByTestId('alert-badge')).not.toBeInTheDocument();
    });

    const bellBtn = screen.getByRole('button', { name: /low-stock alerts: 0 open/i });
    fireEvent.click(bellBtn);

    await waitFor(() => {
      expect(screen.getByText(/all stock levels healthy/i)).toBeInTheDocument();
    });
  });
});
