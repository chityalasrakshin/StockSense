import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from './test-utils';
import { LoginForm } from '@/features/auth/components/login-form';
import * as authContext from '@/features/auth/context/auth-context';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
}));

describe('LoginForm Component', () => {
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: null,
      role: null,
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      signup: vi.fn(),
      logout: vi.fn(),
      updateProfile: vi.fn(),
      refreshUser: vi.fn(),
    });
  });

  it('renders login form elements and demo account buttons', () => {
    renderWithProviders(<LoginForm />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /manager \(full access\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /staff \(operations only\)/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /forgot password\?/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument();
  });

  it('allows clicking quick demo credentials to set staff account', () => {
    renderWithProviders(<LoginForm />);

    const staffButton = screen.getByRole('button', { name: /staff \(operations only\)/i });
    fireEvent.click(staffButton);

    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
    expect(emailInput.value).toBe('staff@stocksense.dev');
  });

  it('submits credentials and redirects staff to /dashboard/receipts', async () => {
    mockLogin.mockResolvedValueOnce({
      accessToken: 'test-token',
      user: {
        id: 'user-staff-id',
        email: 'staff@stocksense.dev',
        role: 'WAREHOUSE_STAFF',
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    });

    renderWithProviders(<LoginForm />);

    const staffButton = screen.getByRole('button', { name: /staff \(operations only\)/i });
    fireEvent.click(staffButton);

    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'staff@stocksense.dev',
        password: 'password123',
      });
      expect(mockPush).toHaveBeenCalledWith('/dashboard/receipts');
    });
  });

  it('submits credentials and redirects manager to /dashboard/overview', async () => {
    mockLogin.mockResolvedValueOnce({
      accessToken: 'test-token',
      user: {
        id: 'user-manager-id',
        email: 'manager@stocksense.dev',
        role: 'INVENTORY_MANAGER',
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    });

    renderWithProviders(<LoginForm />);

    const managerButton = screen.getByRole('button', { name: /manager \(full access\)/i });
    fireEvent.click(managerButton);

    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'manager@stocksense.dev',
        password: 'password123',
      });
      expect(mockPush).toHaveBeenCalledWith('/dashboard/overview');
    });
  });

  it('displays error banner when authentication fails', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid email or password'));

    renderWithProviders(<LoginForm />);

    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
    });
  });
});
