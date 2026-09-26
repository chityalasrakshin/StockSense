'use client';

import { useAuth } from '@/features/auth/context/auth-context';
import type { NavItem, NavGroup } from '@/types';

export function useFilteredNavItems(items: NavItem[]) {
  return items;
}

export function useFilteredNavGroups(groups: NavGroup[]): NavGroup[] {
  let role: string | null = null;
  try {
    const auth = useAuth();
    role = auth.role;
  } catch {
    // If used outside AuthProvider context (e.g. isolated test)
    role = null;
  }

  if (role === 'WAREHOUSE_STAFF') {
    return groups.filter(
      (group) => group.label !== 'Overview' && group.label !== 'Settings',
    );
  }

  return groups;
}
