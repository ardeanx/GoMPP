'use client';

import Link from 'next/link';
import { toAbsoluteUrl } from '@/lib/helpers';
import { useBranding } from '@/components/theme-color-applier';

export function SidebarHeader() {
  const { logoUrl } = useBranding();

  return (
    <div className="hidden lg:flex items-center justify-center shrink-0 pt-8 pb-3.5">
      <Link href="/analytics">
        {logoUrl ? (
          <img
            src={logoUrl}
            className="min-h-[42px] max-h-[42px] object-contain"
            alt="Logo"
          />
        ) : (
          <>
            <img
              src={toAbsoluteUrl('/media/app/mini-logo-square-gray.svg')}
              className="dark:hidden min-h-[42px]"
              alt=""
            />
            <img
              src={toAbsoluteUrl('/media/app/mini-logo-square-gray-dark.svg')}
              className="hidden dark:block min-h-[42px]"
              alt=""
            />
          </>
        )}
      </Link>
    </div>
  );
}
