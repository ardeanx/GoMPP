import { ReactNode, Suspense } from 'react';
import { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { cn } from '@/lib/utils';
import { AuthProvider } from '@/providers/auth-provider';
import { QueryProvider } from '@/providers/query-provider';
import { SettingsProvider } from '@/providers/settings-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeColorApplier } from '@/components/theme-color-applier';
import '@/styles/globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    template: '%s | GoMPP',
    default: 'GoMPP',
  },
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html className="h-full" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/gompp.webp" id="app-favicon" />
      </head>
      <body
        className={cn(
          'antialiased flex h-full text-base text-foreground bg-background',
          inter.className,
        )}
      >
        <QueryProvider>
          <AuthProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              storageKey="nextjs-theme"
              enableSystem
              disableTransitionOnChange
              enableColorScheme
            >
              <SettingsProvider>
                <ThemeColorApplier>
                  <TooltipProvider delayDuration={0}>
                    <Suspense>{children}</Suspense>
                    <Toaster />
                  </TooltipProvider>
                </ThemeColorApplier>
              </SettingsProvider>
            </ThemeProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
