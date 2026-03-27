'use client';

import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LandingPage() {
  const router = useRouter();
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [hoverMode, setHoverMode] = useState<'spor' | 'haber' | null>(null);

  useEffect(() => {
    async function fetchCount() {
      try {
        const supabase = createClient();
        const { data } = await supabase.rpc('get_registered_user_count');
        setMemberCount(Number(data) || 0);
      } catch {
        // silently fail
      }
    }
    fetchCount();
  }, []);

  const handleGoogleLogin = async (mode: string) => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?mode=${mode}`,
      },
    });
  };

  const handleEnter = (mode: string) => {
    router.push(`/app?mode=${mode}`);
  };

  // Arka plan renk geçişi — hover'a göre
  const bgGradient = hoverMode === 'spor'
    ? 'radial-gradient(ellipse at 30% 50%, rgba(239,68,68,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(16,185,129,0.04) 0%, transparent 60%)'
    : hoverMode === 'haber'
    ? 'radial-gradient(ellipse at 70% 50%, rgba(59,130,246,0.08) 0%, transparent 60%), radial-gradient(ellipse at 30% 50%, rgba(99,102,241,0.04) 0%, transparent 60%)'
    : 'none';

  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: bgGradient, transition: 'background 0.8s ease' }}>
      {/* Header */}
      <header className="border-b border-white/5 relative z-10" style={{ background: 'rgba(17,24,39,0.85)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📺</span>
            <h1 className="text-lg font-bold tracking-tight">
              <span className="bg-gradient-to-r from-red-500 to-emerald-400 bg-clip-text text-transparent">Zap</span>Tube
            </h1>
          </div>
          {memberCount !== null && memberCount > 0 && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
              <span>👥</span>
              <span><span className="text-gray-300 font-semibold">{memberCount.toLocaleString('tr-TR')}</span> kişilik aile</span>
            </div>
          )}
        </div>
      </header>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 relative z-10">
        <div className="max-w-4xl mx-auto w-full">
          {/* Başlık */}
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 leading-tight">
              Ne İzlemek İstersin? ⚡
            </h2>
            <p className="text-sm sm:text-base text-gray-500 max-w-md mx-auto">
              Seni doğru kanala zaplarız. Seç ve başla.
            </p>
          </div>

          {/* İki Büyük Mod Kartı */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-10 max-w-3xl mx-auto">
            {/* SPOR KARTI */}
            <button
              onClick={() => handleEnter('spor')}
              onMouseEnter={() => setHoverMode('spor')}
              onMouseLeave={() => setHoverMode(null)}
              className="group relative bg-[#1e293b] rounded-2xl p-6 sm:p-8 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl border border-transparent hover:border-red-500/30 overflow-hidden"
            >
              {/* Arka plan efekti */}
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10">
                <div className="text-5xl sm:text-6xl mb-4">⚽</div>
                <h3 className="text-xl sm:text-2xl font-bold mb-2">
                  <span className="bg-gradient-to-r from-red-400 to-emerald-400 bg-clip-text text-transparent">Spor</span>
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 leading-relaxed mb-4">
                  Türk futbol YouTube kanalları, canlı yayınlar, maç özetleri, taktik analizler ve takım sohbetleri
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {['GS', 'FB', 'BJK', 'TS'].map(team => (
                    <span key={team} className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-gray-400">{team}</span>
                  ))}
                  <span className="text-[10px] px-2 py-1 rounded-full bg-red-500/10 text-red-400">CANLI</span>
                </div>
                <div className="mt-5 flex items-center gap-2 text-sm font-medium text-red-400 group-hover:text-red-300 transition-colors">
                  <span>Giriş Yap</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            </button>

            {/* HABER & EKONOMİ KARTI */}
            <button
              onClick={() => handleEnter('haber')}
              onMouseEnter={() => setHoverMode('haber')}
              onMouseLeave={() => setHoverMode(null)}
              className="group relative bg-[#1e293b] rounded-2xl p-6 sm:p-8 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl border border-transparent hover:border-blue-500/30 overflow-hidden"
            >
              {/* Arka plan efekti */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10">
                <div className="text-5xl sm:text-6xl mb-4">📰</div>
                <h3 className="text-xl sm:text-2xl font-bold mb-2">
                  <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Haber & Ekonomi</span>
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 leading-relaxed mb-4">
                  Canlı haber kanalları, son dakika haberleri, ekonomi, dünya gündemi ve piyasa takibi
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {['Gündem', 'Ekonomi', 'Dünya'].map(cat => (
                    <span key={cat} className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-gray-400">{cat}</span>
                  ))}
                  <span className="text-[10px] px-2 py-1 rounded-full bg-blue-500/10 text-blue-400">7/24</span>
                </div>
                <div className="mt-5 flex items-center gap-2 text-sm font-medium text-blue-400 group-hover:text-blue-300 transition-colors">
                  <span>Giriş Yap</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            </button>
          </div>

          {/* Google ile Üye Ol — ortak */}
          <div className="text-center max-w-sm mx-auto">
            <p className="text-[11px] text-gray-600 mb-3">Sohbet ve bildirimler için üye ol</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button onClick={() => handleGoogleLogin('spor')}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-xs hover:bg-white/10 hover:text-white transition-all">
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google ile Üye Ol
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-4 text-center text-xs text-gray-600 relative z-10">
        <p>ZapTube — Türkiye'nin kumandası ⚡</p>
      </footer>
    </main>
  );
}
