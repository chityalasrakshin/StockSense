import { NavGroup } from '@/types';

export const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        title: 'Dashboard',
        url: '/dashboard/overview',
        icon: 'dashboard',
        isActive: true,
        shortcut: ['d', 'd'],
        items: [],
      },
      {
        title: 'Products',
        url: '/dashboard/products',
        icon: 'product',
        shortcut: ['p', 'p'],
        isActive: false,
        items: [],
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        title: 'Receipts',
        url: '/dashboard/receipts',
        icon: 'add',
        shortcut: ['r', 'r'],
        isActive: false,
        items: [],
      },
      {
        title: 'Delivery Orders',
        url: '/dashboard/deliveries',
        icon: 'arrowRight',
        shortcut: ['d', 'o'],
        isActive: false,
        items: [],
      },
      {
        title: 'Internal Transfers',
        url: '/dashboard/transfers',
        icon: 'share',
        shortcut: ['i', 't'],
        isActive: false,
        items: [],
      },
      {
        title: 'Stock Adjustments',
        url: '/dashboard/adjustments',
        icon: 'adjustments',
        shortcut: ['s', 'a'],
        isActive: false,
        items: [],
      },
    ],
  },
  {
    label: 'Ledger & Analytics',
    items: [
      {
        title: 'Move History',
        url: '/dashboard/move-history',
        icon: 'clock',
        shortcut: ['m', 'h'],
        isActive: false,
        items: [],
      },
    ],
  },
  {
    label: 'Settings',
    items: [
      {
        title: 'Warehouses',
        url: '/dashboard/settings/warehouses',
        icon: 'settings',
        shortcut: ['s', 'w'],
        isActive: false,
        items: [],
      },
    ],
  },
];
