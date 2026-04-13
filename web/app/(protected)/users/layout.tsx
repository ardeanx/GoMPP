'use client';

import { ReactNode } from 'react';
import { AdminGuard } from '@/components/auth-guard';

export default function Layout({ children }: { children: ReactNode }) {
  return <AdminGuard>{children}</AdminGuard>;
}
