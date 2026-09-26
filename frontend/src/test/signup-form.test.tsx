import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from './test-utils';
import { SignupForm } from '@/features/auth/components/signup-form';
import * as authContext from '@/features/auth/context/auth-context';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
}));

describe('SignupForm Component', () => {
  const mockSignup = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: null,
      role: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      signup: mockSignup,
      logout: vi.fn(),
      updateProfile: vi.fn(),
      refreshUser: vi.fn(),
    });
  });

  it('renders signup fields and role selector', () => {
    renderWithProviders(<SignupForm />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByText(/designated role/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /warehouse staff/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /inventory manager/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('shows error when passwords do not match', async () => {
    renderWithProviders(<SignupForm />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'newuser@stocksense.dev' },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'mismatch456' },
    });

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/passwords do not match/i);
      expect(mockSignup).not.toHaveBeenCalled();
    });
  });

  it('successfully creates an inventory manager account and redirects to /dashboard/overview', async () => {
    mockSignup.mockResolvedValueOnce({
      accessToken: 'signup-token',
      user: {
        id: 'new-user-id',
        email: 'newmgr@stocksense.dev',
        role: 'INVENTORY_MANAGER',
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    });

    renderWithProviders(<SignupForm />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'newmgr@stocksense.dev' },
    });
    fireEvent.click(screen.getByRole('button', { name: /inventory manager/i }));
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockSignup).toHaveBeenCalledWith({
        email: 'newmgr@stocksense.dev',
        password: 'password123',
        confirmPassword: 'password123',
        role: 'INVENTORY_MANAGER',
      });
      expect(mockPush).toHaveBeenCalledWith('/dashboard/overview');
    });
  });
});
