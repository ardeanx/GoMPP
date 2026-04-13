import { Metadata } from 'next';
import { LayoutProvider } from '@/components/layouts/shared/context';
import { Main } from './components/main';

// Generate metadata for the layout
export async function generateMetadata(): Promise<Metadata> {
  // You can access route params here if needed
  // const { params } = props;

  return {
    title: 'Dashboard',
    description: '',
  };
}

export function Layouts({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LayoutProvider>
        <Main>{children}</Main>
      </LayoutProvider>
    </>
  );
}
