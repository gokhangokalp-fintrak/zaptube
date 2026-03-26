'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/app/admin', label: 'Dashboard', icon: '📊' },
  { href: '/app/admin/channels', label: 'Kanallar', icon: '📺' },
  { href: '/app/admin/sponsors', label: 'Reklamlar', icon: '💰' },
];

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#111827]/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/app" className="text-gray-400 hover:text-white text-sm transition-colors">
              ← Ana Sayfa
            </Link>
            <div className="h-4 w-px bg-white/10"></div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-red-400">⚙</span> Admin Paneli
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">ZapTube Yönetim</span>
            <div className="w-7 h-7 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-xs text-red-400">
              A
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        {/* Sidebar Navigation */}
        <nav className="w-56 shrink-0">
          <div className="sticky top-20 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = item.href === '/app/admin'
                ? pathname === '/app/admin'
                : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
