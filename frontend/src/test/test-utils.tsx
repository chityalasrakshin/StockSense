import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
    },
  });
}

interface TestWrapperProps {
  children: React.ReactNode;
  queryClient: QueryClient;
}

export function TestWrapper({ children, queryClient }: TestWrapperProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter>{children}</NuqsTestingAdapter>
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { queryClient?: QueryClient },
) {
  const queryClient = options?.queryClient ?? createTestQueryClient();
  const { queryClient: _qc, ...renderOptions } = options || {};

  return render(ui, {
    wrapper: ({ children }) => (
      <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    ),
    ...renderOptions,
  });
}
