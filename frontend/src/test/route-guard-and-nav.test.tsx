import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useFilteredNavGroups } from '@/hooks/use-nav';
import { navGroups } from '@/config/nav-config';
import { AuthGuard } from '@/features/auth/components/auth-guard';
import * as authContext from '@/features/auth/context/auth-context';

const mockReplace = vi.fn();
let currentPathname = '/dashboard/overview';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: mockReplace,
  }),
  usePathname: () => currentPathname,
}));

describe('Route Guard and Role-Aware Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useFilteredNavGroups', () => {
    it('restricts WAREHOUSE_STAFF navigation to Operations, Move History, and Profile Menu', () => {
      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        user: {
          id: 'staff-1',
          email: 'staff@stocksense.dev',
          role: 'WAREHOUSE_STAFF',
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        role: 'WAREHOUSE_STAFF',
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        signup: vi.fn(),
        logout: vi.fn(),
        updateProfile: vi.fn(),
        refreshUser: vi.fn(),
      });

      function TestNav() {
        const groups = useFilteredNavGroups(navGroups);
        return (
          <ul>
            {groups.map((g) => (
              <li key={g.label}>{g.label}</li>
            ))}
          </ul>
        );
      }

      render(<TestNav />);

      // Staff SHOULD see:
      expect(screen.getByText('Operations')).toBeInTheDocument();
      expect(screen.getByText('Ledger & Analytics')).toBeInTheDocument();
      expect(screen.getByText('Profile Menu')).toBeInTheDocument();

      // Staff should NOT see:
      expect(screen.queryByText('Overview')).not.toBeInTheDocument();
      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });

    it('grants INVENTORY_MANAGER full navigation including Dashboard, Products, Settings, Warehouses', () => {
      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        user: {
          id: 'manager-1',
          email: 'manager@stocksense.dev',
          role: 'INVENTORY_MANAGER',
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        role: 'INVENTORY_MANAGER',
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        signup: vi.fn(),
        logout: vi.fn(),
        updateProfile: vi.fn(),
        refreshUser: vi.fn(),
      });

      function TestNav() {
        const groups = useFilteredNavGroups(navGroups);
        return (
          <ul>
            {groups.map((g) => (
              <li key={g.label}>{g.label}</li>
            ))}
          </ul>
        );
      }

      render(<TestNav />);

      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Operations')).toBeInTheDocument();
      expect(screen.getByText('Ledger & Analytics')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Profile Menu')).toBeInTheDocument();
    });
  });

  describe('AuthGuard Route Protection', () => {
    it('redirects unauthenticated callers to /login', () => {
      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        user: null,
        role: null,
        isAuthenticated: false,
        isLoading: false,
        login: vi.fn(),
        signup: vi.fn(),
        logout: vi.fn(),
        updateProfile: vi.fn(),
        refreshUser: vi.fn(),
      });

      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>,
      );

      expect(mockReplace).toHaveBeenCalledWith('/login');
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('redirects WAREHOUSE_STAFF trying to access /dashboard/overview to /dashboard/receipts', () => {
      currentPathname = '/dashboard/overview';

      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        user: {
          id: 'staff-1',
          email: 'staff@stocksense.dev',
          role: 'WAREHOUSE_STAFF',
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        role: 'WAREHOUSE_STAFF',
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        signup: vi.fn(),
        logout: vi.fn(),
        updateProfile: vi.fn(),
        refreshUser: vi.fn(),
      });

      render(
        <AuthGuard>
          <div>Manager Only Content</div>
        </AuthGuard>,
      );

      expect(mockReplace).toHaveBeenCalledWith('/dashboard/receipts');
      expect(screen.queryByText('Manager Only Content')).not.toBeInTheDocument();
    });

    it('allows INVENTORY_MANAGER to view /dashboard/overview', () => {
      currentPathname = '/dashboard/overview';

      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        user: {
          id: 'manager-1',
          email: 'manager@stocksense.dev',
          role: 'INVENTORY_MANAGER',
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        role: 'INVENTORY_MANAGER',
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        signup: vi.fn(),
        logout: vi.fn(),
        updateProfile: vi.fn(),
        refreshUser: vi.fn(),
      });

      render(
        <AuthGuard>
          <div>Manager Only Content</div>
        </AuthGuard>,
      );

      expect(mockReplace).not.toHaveBeenCalled();
      expect(screen.getByText('Manager Only Content')).toBeInTheDocument();
    });
  });
});
