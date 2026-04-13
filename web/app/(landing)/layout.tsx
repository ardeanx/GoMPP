import { ReactNode } from 'react';

export default function LandingLayout({ children }: { children: ReactNode }) {
  return <div className="flex flex-col min-h-screen w-full">{children}</div>;
}
