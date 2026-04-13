import { BarChart3, Cog, Folders, ShieldUser } from 'lucide-react';
import { type MenuConfig } from './types';

export const MENU_SIDEBAR: MenuConfig = [
  {
    title: 'Analytics',
    icon: BarChart3,
    path: '/analytics',
  },
  {
    title: 'Library',
    icon: Folders,
    path: '/library',
  },
  {
    title: 'Users',
    icon: ShieldUser,
    path: '/users',
  },
  {
    title: 'Settings',
    icon: Cog,
    path: '/settings',
  },
];
