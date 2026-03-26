import AdminLayoutClient from '@/components/AdminLayoutClient';

// Force dynamic rendering — admin pages need Supabase at runtime
export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
