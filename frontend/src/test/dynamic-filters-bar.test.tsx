import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from './test-utils';
import { DynamicFiltersBar } from '@/features/dashboard/components/dynamic-filters-bar';
import * as dashboardApi from '@/features/dashboard/api';

const mockMetadata: dashboardApi.FiltersMetadata = {
  documentTypes: [
    { label: 'Receipts', value: 'RECEIPT' },
    { label: 'Deliveries', value: 'DELIVERY' },
    { label: 'Internal Transfers', value: 'TRANSFER' },
    { label: 'Adjustments', value: 'ADJUSTMENT' },
  ],
  statuses: [
    { label: 'Draft', value: 'DRAFT' },
    { label: 'Waiting', value: 'WAITING' },
    { label: 'Ready', value: 'READY' },
    { label: 'Done', value: 'DONE' },
    { label: 'Canceled', value: 'CANCELED' },
  ],
  warehouses: [
    {
      id: 'l0000000-0000-0000-0000-000000000001',
      name: 'Main Warehouse',
      label: 'Main Warehouse [WH]',
      value: 'l0000000-0000-0000-0000-000000000001',
      shortCode: 'WH',
      type: 'WAREHOUSE',
    },
    {
      id: 'l0000000-0000-0000-0000-000000000002',
      name: 'Production Rack',
      label: 'Production Rack [WH-PR]',
      value: 'l0000000-0000-0000-0000-000000000002',
      shortCode: 'WH-PR',
      type: 'RACK',
    },
  ],
  categories: [
    {
      id: 'c0000000-0000-0000-0000-000000000001',
      name: 'Raw Materials',
      label: 'Raw Materials',
      value: 'c0000000-0000-0000-0000-000000000001',
      parentId: null,
    },
    {
      id: 'c0000000-0000-0000-0000-000000000002',
      name: 'Fasteners & Hardware',
      label: 'Fasteners & Hardware',
      value: 'c0000000-0000-0000-0000-000000000002',
      parentId: null,
    },
  ],
};

describe('DynamicFiltersBar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(dashboardApi, 'getFiltersMetadata').mockResolvedValue(mockMetadata);
  });

  it('renders filter controls and search input', async () => {
    renderWithProviders(<DynamicFiltersBar initialMetadata={mockMetadata} />);

    expect(screen.getByTestId('dynamic-filters-bar')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search ref or partner/i)).toBeInTheDocument();
    expect(screen.getByText(/dynamic filters/i)).toBeInTheDocument();
  });

  it('updates search query and shows filter pill', async () => {
    renderWithProviders(<DynamicFiltersBar initialMetadata={mockMetadata} />);

    const searchInput = screen.getByPlaceholderText(/search ref or partner/i);
    fireEvent.change(searchInput, { target: { value: 'WH/IN' } });

    await waitFor(() => {
      expect(screen.getByText(/query: "wh\/in"/i)).toBeInTheDocument();
      expect(screen.getByText(/reset all filters/i)).toBeInTheDocument();
    });

    const resetBtn = screen.getByText(/reset all filters/i);
    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(screen.queryByText(/query: "wh\/in"/i)).not.toBeInTheDocument();
    });
  });
});
