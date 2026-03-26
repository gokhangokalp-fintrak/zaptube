'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';

// ============================================
// 1) Inline Uyarı — aksiyon engellendiğinde gösterilir
// ============================================
interface GuestActionBlockProps {
  message?: string;
  compact?: boolean;
}

export function GuestActionBlock({ message = 'Bu özelliği kullanmak için ücretsiz üye ol', compact = false }: GuestActionBlockProps) {
  const handleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-gray-500 text-xs">{message}</span>
        <button
          onClick={handleLogin}
          className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-lg font-medium transition-colors"
        >
          Ücretsiz Üye Ol
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-red-500/10 to-emerald-500/10 border border-white/10 rounded-xl p-4 text-center">
      <p className="text-sm text-gray-300 mb-3">{message}</p>
      <button
        onClick={handleLogin}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-gray-900 font-semibold text-sm hover:bg-gray-100 transition-all hover:scale-105 shadow-lg shadow-white/5"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Google ile Ücretsiz Üye Ol
      </button>
      <p className="text-[10px] text-gray-600 mt-2">Sohbet, bildirim, favori ve daha fazlası</p>
    </div>
  );
}

// ============================================
// 2) Zamanlı Hatırlatma Banner — belirli süre sonra çıkar
// ============================================
const REMINDER_DELAYS = [
  { delay: 90_000, message: 'Ücretsiz üye ol, sohbete katıl!' },       // 1.5 dk
  { delay: 300_000, message: 'Kanalları takip et, bildirimleri aç!' },    // 5 dk
  { delay: 600_000, message: 'ZapTube deneyimini kişiselleştir!' },      // 10 dk
];

export function GuestReminderBanner() {
  const [visible, setVisible] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user);
    });
  }, []);

  useEffect(() => {
    // Sadece misafirler için
    if (user || dismissed) return;

    // Daha önce kapatıldıysa bu oturumda tekrar gösterme
    if (typeof window !== 'undefined' && sessionStorage.getItem('zaptube_reminder_dismissed')) {
      setDismissed(true);
      return;
    }

    const timers: NodeJS.Timeout[] = [];

    REMINDER_DELAYS.forEach(({ delay, message }) => {
      const timer = setTimeout(() => {
        if (!dismissed) {
          setCurrentMessage(message);
          setVisible(true);
          // 15 saniye sonra otomatik kapat
          setTimeout(() => setVisible(false), 15000);
        }
      }, delay);
      timers.push(timer);
    });

    return () => timers.forEach(clearTimeout);
  }, [user, dismissed]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setDismissed(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('zaptube_reminder_dismissed', '1');
    }
  }, []);

  const handleLogin = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }, []);

  if (!visible || user || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md animate-slide-up">
      <div className="bg-gradient-to-r from-[#1a1a3e] to-[#1e293b] border border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/50 flex items-center gap-3">
        <div className="shrink-0 text-2xl">⚡</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{currentMessage}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Tamamen ücretsiz, sadece Google hesabınla</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleLogin}
            className="px-3 py-2 bg-white text-gray-900 text-xs font-bold rounded-lg hover:bg-gray-100 transition-all active:scale-95"
          >
            Üye Ol
          </button>
          <button
            onClick={handleDismiss}
            className="text-gray-600 hover:text-gray-400 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 3) Toast uyarısı — küçük bildirim
// ============================================
interface GuestToastProps {
  message: string;
  onClose: () => void;
}

export function GuestToast({ message, onClose }: GuestToastProps) {
  const handleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  useEffect(() => {
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 right-4 z-[200] bg-orange-500/90 backdrop-blur-sm text-white text-sm px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-slide-down max-w-sm">
      <span>{message}</span>
      <button
        onClick={handleLogin}
        className="shrink-0 px-2.5 py-1 bg-white text-gray-900 text-xs font-bold rounded-lg hover:bg-gray-100 transition-all"
      >
        Üye Ol
      </button>
      <button onClick={onClose} className="text-white/60 hover:text-white shrink-0">✕</button>
    </div>
  );
}
