import PageViewTracker from '@/components/PageViewTracker';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageViewTracker />
      {children}
    </>
  );
}
