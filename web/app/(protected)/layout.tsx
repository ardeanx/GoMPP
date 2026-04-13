'use client';

import { ReactNode } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { Layouts } from '@/components/layouts/main';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <Layouts>{children}</Layouts>
    </AuthGuard>
  );
}
