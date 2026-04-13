'use client';

import { ReactNode } from 'react';
import { MainLayout } from './layouts/main';

export default function Layout({ children }: { children: ReactNode }) {
  return <MainLayout>{children}</MainLayout>;
}
