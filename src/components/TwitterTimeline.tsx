'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Türk futbol dünyasının sürekli tweet atan yüksek takipçili hesapları
const FOOTBALL_ACCOUNTS = [
  // === KULÜPLER (Resmi) ===
  { handle: 'GalatasaraySK', name: 'Galatasaray', team: 'galatasaray', category: 'club', emoji: '🟡🔴' },
  { handle: 'Fenerbahce', name: 'Fenerbahçe', team: 'fenerbahce', category: 'club', emoji: '💛💙' },
  { handle: 'Besiktas', name: 'Beşiktaş', team: 'besiktas', category: 'club', emoji: '⚫⚪' },
  { handle: 'Trabzonspor', name: 'Trabzonspor', team: 'trabzonspor', category: 'club', emoji: '🔵🟤' },
  // === SPOR MEDYASI ===
  { handle: 'futbolarena', name: 'FutbolArena', team: 'genel', category: 'media', emoji: '📰' },
  { handle: 'sporarena', name: 'Spor Arena', team: 'genel', category: 'media', emoji: '📰' },
  { handle: 'ASpor', name: 'A Spor', team: 'genel', category: 'media', emoji: '📺' },
  { handle: 'NTVSpor', name: 'NTV Spor', team: 'genel', category: 'media', emoji: '📺' },
  // === GAZETECİLER / MUHABİRLER ===
  { handle: 'yagosabuncuoglu', name: 'Yağız Sabuncuoğlu', team: 'genel', category: 'journalist', emoji: '🎤' },
  { handle: 'ercantofficial', name: 'Ercan Taner', team: 'genel', category: 'journalist', emoji: '🎤' },
  { handle: 'aliececom', name: 'Ali Ece', team: 'genel', category: 'journalist', emoji: '🎤' },
  { handle: 'Sinamekiserdar', name: 'Serdar Ali Çelikler', team: 'genel', category: 'journalist', emoji: '🎤' },
  { handle: 'nevzatdindar', name: 'Nevzat Dindar', team: 'galatasaray', category: 'journalist', emoji: '🟡🔴🎤' },
  { handle: 'emrekbol', name: 'Emre Bol', team: 'genel', category: 'journalist', emoji: '🎤' },
  { handle: 'fatihaltayli', name: 'Fatih Altaylı', team: 'genel', category: 'journalist', emoji: '🎤' },
  // === TRANSFER & GÜNDEM ===
  { handle: 'nexustransfer', name: 'Nexus Transfer', team: 'genel', category: 'transfer', emoji: '🔄' },
  { handle: 'Transferhaber6', name: 'Transfer Haberleri', team: 'genel', category: 'transfer', emoji: '🔄' },
  // === RESMİ ===
  { handle: 'TFF_Org', name: 'TFF', team: 'genel', category: 'official', emoji: '🇹🇷' },
];

interface TwitterTimelineProps {
  handle?: string;
  height?: number;
  theme?: 'dark' | 'light';
  showSelector?: boolean;
  compact?: boolean;
  title?: string;
}

type LoadState = 'loading' | 'syndication' | 'embed' | 'fallback';

export default function TwitterTimeline({
  handle,
  height = 500,
  theme = 'dark',
  showSelector = false,
  compact = false,
  title,
}: TwitterTimelineProps) {
  const [selectedHandle, setSelectedHandle] = useState(handle || FOOTBALL_ACCOUNTS[0].handle);
  const [embedKey, setEmbedKey] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [syndicationHtml, setSyndicationHtml] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const embedHandle = handle || selectedHandle;
  const effectiveHeight = compact ? 300 : height;

  useEffect(() => {
    if (handle) setSelectedHandle(handle);
  }, [handle]);

  // Server-side syndication API'den tweet HTML'i çek
  const fetchSyndication = useCallback(async (h: string) => {
    try {
      const res = await fetch(`/api/twitter/syndication?handle=${encodeURIComponent(h)}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.html && data.html.length > 100) {
        return data.html as string;
      }
    } catch (e) {
      console.log('[TwitterTimeline] Syndication fetch failed:', e);
    }
    return null;
  }, []);

  // Ana yükleme stratejisi
  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    setSyndicationHtml(null);

    async function load() {
      // 1. Server-side syndication dene
      const html = await fetchSyndication(embedHandle);
      if (cancelled) return;

      if (html) {
        setSyndicationHtml(html);
        setLoadState('syndication');
        return;
      }

      // 2. Syndication başarısız — iframe embed dene (login olan kullanıcılar için)
      setLoadState('embed');

      // 15sn sonra hala embed yüklenmediyse fallback göster
      setTimeout(() => {
        if (!cancelled) {
          setLoadState(prev => prev === 'embed' ? 'fallback' : prev);
        }
      }, 15000);
    }

    load();
    return () => { cancelled = true; };
  }, [embedHandle, embedKey, fetchSyndication]);

  // Syndication HTML'ini iframe'de göster
  useEffect(() => {
    if (loadState === 'syndication' && syndicationHtml && iframeRef.current) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        // Syndication HTML'i — tweet kartları içeren tam sayfa
        const isFullPage = syndicationHtml.includes('<!DOCTYPE') || syndicationHtml.includes('<html');

        if (isFullPage) {
          doc.open();
          doc.write(syndicationHtml);
          doc.close();
        } else {
          // oEmbed veya kısmi HTML — wrapper ile sar
          doc.open();
          doc.write(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: ${theme === 'dark' ? '#1e293b' : '#fff'}; color: ${theme === 'dark' ? '#e2e8f0' : '#1a1a2e'}; font-family: -apple-system, BlinkMacSystemFont, sans-serif; overflow-x: hidden; }
.twitter-timeline { width: 100% !important; }
</style>
</head><body>
${syndicationHtml}
<script src="https://platform.twitter.com/widgets.js" charset="utf-8" async><\/script>
</body></html>`);
          doc.close();
        }
      }
    }
  }, [loadState, syndicationHtml, theme]);

  const currentAccount = FOOTBALL_ACCOUNTS.find(a => a.handle === selectedHandle);

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden bg-[#1e293b]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 bg-[#111827]/80">
        <div className="flex items-center justify-between">
          <h3 className={`font-bold text-white flex items-center gap-2 ${compact ? 'text-sm' : 'text-base'}`}>
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-white" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            {title || (currentAccount ? `${currentAccount.emoji} ${currentAccount.name}` : 'Futbol Gündemi')}
          </h3>
          <a
            href={`https://x.com/${embedHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-[#1DA1F2] transition-colors"
          >
            @{embedHandle} ↗
          </a>
        </div>
      </div>

      {/* Account Selector */}
      {showSelector && (
        <div className="px-3 py-2 border-b border-white/10 bg-[#111827]/50 overflow-x-auto">
          <div className="flex gap-1.5 min-w-max">
            {FOOTBALL_ACCOUNTS.map((account) => (
              <button
                key={account.handle}
                onClick={() => {
                  setSelectedHandle(account.handle);
                  setEmbedKey(prev => prev + 1);
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                  selectedHandle === account.handle
                    ? 'bg-[#1DA1F2] text-white shadow-lg shadow-[#1DA1F2]/20'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {account.emoji} {account.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Timeline Content */}
      <div ref={containerRef} style={{ minHeight: effectiveHeight }} className="relative">
        {/* Loading State */}
        {loadState === 'loading' && (
          <div className="flex flex-col items-center justify-center text-gray-400 py-12" style={{ minHeight: effectiveHeight }}>
            <div className="w-8 h-8 border-2 border-[#1DA1F2] border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm">Twitter yükleniyor...</p>
          </div>
        )}

        {/* Syndication HTML (server-side rendered) */}
        {loadState === 'syndication' && (
          <iframe
            ref={iframeRef}
            title={`${embedHandle} Twitter Timeline`}
            style={{ width: '100%', height: effectiveHeight, border: 'none' }}
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          />
        )}

        {/* Embed mode — X widget iframe from twitter-embed.html */}
        {loadState === 'embed' && (
          <iframe
            src={`/twitter-embed.html?handle=${encodeURIComponent(embedHandle)}&theme=${theme}&height=${effectiveHeight}&chrome=noheader%20nofooter`}
            title={`${embedHandle} Twitter Timeline`}
            style={{ width: '100%', height: effectiveHeight, border: 'none' }}
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          />
        )}

        {/* Fallback */}
        {loadState === 'fallback' && (
          <div className="flex flex-col items-center justify-center px-4 py-8" style={{ minHeight: effectiveHeight }}>
            <svg viewBox="0 0 24 24" className="w-10 h-10 fill-current text-gray-600 mb-3" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <p className="text-gray-300 text-sm mb-1 font-medium">Twitter timeline yüklenemedi</p>
            <p className="text-gray-500 text-xs mb-4 text-center max-w-xs">
              X hesabınızla tarayıcınızdan giriş yaparsanız tweetler otomatik olarak görünecektir
            </p>
            <a
              href={`https://x.com/${embedHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2 bg-[#1DA1F2] text-white rounded-full text-sm font-medium hover:bg-[#1DA1F2]/80 transition-colors mb-4"
            >
              @{embedHandle} profilini X'te aç
            </a>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {FOOTBALL_ACCOUNTS.filter(a => a.category === 'club').map(acc => (
                <a
                  key={acc.handle}
                  href={`https://x.com/${acc.handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-white/5 rounded-full text-xs text-gray-400 hover:bg-white/10 hover:text-[#1DA1F2] transition-colors"
                >
                  {acc.emoji} {acc.name}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Sidebar widget
export function TwitterFeedWidget() {
  return (
    <TwitterTimeline
      showSelector={true}
      height={400}
      compact={true}
      title="Futbol Gündemi"
    />
  );
}

export { FOOTBALL_ACCOUNTS };
