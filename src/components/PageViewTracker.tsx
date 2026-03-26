'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase';

// Tarayıcı session ID'si (anonim takip için)
function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let sid = sessionStorage.getItem('zaptube_sid');
  if (!sid) {
    sid = `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem('zaptube_sid', sid);
  }
  return sid;
}

export default function PageViewTracker() {
  const pathname = usePathname();
  const lastTracked = useRef<string>('');

  useEffect(() => {
    // Aynı sayfayı tekrar takip etme
    if (pathname === lastTracked.current) return;
    lastTracked.current = pathname;

    async function trackView() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const sessionId = getSessionId();

        await supabase.from('page_views').insert({
          page: pathname,
          user_id: user?.id || null,
          session_id: sessionId,
        });
      } catch {
        // Tablo henüz yoksa veya hata olursa sessizce geç
      }
    }

    // Kısa gecikme ile track et (sayfa tam yüklensin)
    const timer = setTimeout(trackView, 1000);
    return () => clearTimeout(timer);
  }, [pathname]);

  return null; // Görsel bir şey render etmez
}
