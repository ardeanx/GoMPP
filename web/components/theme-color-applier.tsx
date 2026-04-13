'use client';

import { createContext, useContext, useEffect, useMemo } from 'react';
import { useSystemSettings } from '@/services/settings';

// Theme color helpers

function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
  ];
}

function getContrastForeground(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#ffffff';
  const [r, g, b] = rgb.map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.4 ? '#000000' : '#ffffff';
}

export function applyThemeColor(hex: string) {
  const el = document.documentElement;
  el.style.setProperty('--primary', hex);
  el.style.setProperty('--primary-foreground', getContrastForeground(hex));
}

export function clearThemeColor() {
  const el = document.documentElement;
  el.style.removeProperty('--primary');
  el.style.removeProperty('--primary-foreground');
}

// Favicon helper

export function applyFavicon(url: string) {
  const link = document.getElementById('app-favicon') as HTMLLinkElement | null;
  if (link) {
    link.href = url;
  }
}

export function clearFavicon() {
  const link = document.getElementById('app-favicon') as HTMLLinkElement | null;
  if (link) {
    link.href = '/gompp.webp';
  }
}

// Branding context (logo)

interface BrandingValue {
  logoUrl: string | undefined;
  faviconUrl: string | undefined;
}

const BrandingContext = createContext<BrandingValue>({
  logoUrl: '/gompp.webp',
  faviconUrl: '/gompp.webp',
});

export function useBranding() {
  return useContext(BrandingContext);
}

// Component

export function ThemeColorApplier({
  children,
}: {
  children?: React.ReactNode;
}) {
  const { data } = useSystemSettings();
  const settings = data?.data ?? [];

  const themeColor = settings.find((s) => s.key === 'theme_color')?.value as
    | string
    | undefined;
  const siteLogo = settings.find((s) => s.key === 'site_logo')?.value as
    | string
    | undefined;
  const siteFavicon = settings.find((s) => s.key === 'site_favicon')?.value as
    | string
    | undefined;

  // Apply theme color
  useEffect(() => {
    if (!themeColor || !/^#[0-9a-f]{6}$/i.test(themeColor)) return;
    applyThemeColor(themeColor);
    return () => clearThemeColor();
  }, [themeColor]);

  // Apply favicon
  useEffect(() => {
    if (!siteFavicon) return;
    applyFavicon(siteFavicon);
    return () => clearFavicon();
  }, [siteFavicon]);

  const branding = useMemo<BrandingValue>(
    () => ({
      logoUrl: siteLogo || '/gompp.webp',
      faviconUrl: siteFavicon || '/gompp.webp',
    }),
    [siteLogo, siteFavicon],
  );

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}
