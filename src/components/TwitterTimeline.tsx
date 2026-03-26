'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Script from 'next/script';

// Türk futbol dünyasının sürekli tweet atan yüksek takipçili hesapları
const FOOTBALL_ACCOUNTS = [
  // === KULÜPLER (Resmi) ===
  { handle: 'GalatasaraySK', name: 'Galatasaray', team: 'galatasaray', category: 'club', emoji: '🟡🔴' },
  { handle: 'Fenerbahce', name: 'Fenerbahçe', team: 'fenerbahce', category: 'club', emoji: '💛💙' },
  { handle: 'Besiktas', name: 'Beşiktaş', team: 'besiktas', category: 'club', emoji: '⚫⚪' },
  { handle: 'Trabzonspor', name: 'Trabzonspor', team: 'trabzonspor', category: 'club', emoji: '🔵🟤' },
  // === SPOR MEDYASI — sürekli haber akışı ===
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

// Global flag — widgets.js yüklendi mi?
let widgetsReady = false;
const readyCallbacks: (() => void)[] = [];

function onWidgetsReady(cb: () => void) {
  if (widgetsReady) {
    cb();
  } else {
    readyCallbacks.push(cb);
  }
}

// Bu component sayfada bir kez widgets.js'i yükler
export function TwitterWidgetsScript() {
  return (
    <Script
      src="https://platform.twitter.com/widgets.js"
      strategy="lazyOnload"
      onLoad={() => {
        const check = setInterval(() => {
          const twttr = (window as any).twttr;
          if (twttr?.widgets) {
            clearInterval(check);
            widgetsReady = true;
            readyCallbacks.forEach(cb => cb());
            readyCallbacks.length = 0;
          }
        }, 100);
        setTimeout(() => clearInterval(check), 15000);
      }}
    />
  );
}

interface TwitterTimelineProps {
  handle?: string;
  listUrl?: string;
  height?: number;
  theme?: 'dark' | 'light';
  showSelector?: boolean;
  compact?: boolean;
  title?: string;
}

export default function TwitterTimeline({
  handle,
  listUrl,
  height = 500,
  theme = 'dark',
  showSelector = false,
  compact = false,
  title,
}: TwitterTimelineProps) {
  const [selectedHandle, setSelectedHandle] = useState(handle || FOOTBALL_ACCOUNTS[0].handle);
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  const embedHandle = handle || selectedHandle;

  useEffect(() => {
    if (handle) setSelectedHandle(handle);
  }, [handle]);

  // Embed the timeline using Twitter's official method
  const renderTimeline = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    setStatus('loading');

    // Clear previous content
    container.innerHTML = '';

    const twttr = (window as any).twttr;
    if (!twttr?.widgets?.createTimeline) {
      // Fallback: inject anchor tag and let widgets.js handle it
      const embedUrl = listUrl || `https://twitter.com/${embedHandle}`;
      container.innerHTML = `<a class="twitter-timeline" data-height="${height}" data-theme="${theme}" data-chrome="noheader nofooter" data-lang="tr" data-dnt="true" href="${embedUrl}?ref_src=twsrc%5Etfw">@${embedHandle} tweetleri</a>`;

      if (twttr?.widgets?.load) {
        twttr.widgets.load(container);
      }

      // Check if rendered
      setTimeout(() => {
        if (container.querySelector('iframe')) {
          setStatus('loaded');
        } else {
          setStatus('error');
        }
      }, 8000);
      return;
    }

    // Use createTimeline API (preferred)
    twttr.widgets.createTimeline(
      { sourceType: 'profile', screenName: embedHandle },
      container,
      {
        height: height,
        theme: theme,
        chrome: 'noheader nofooter',
        lang: 'tr',
        dnt: true,
      }
    ).then((el: any) => {
      if (el) {
        setStatus('loaded');
      } else {
        // createTimeline returned null — try anchor fallback
        const embedUrl = listUrl || `https://twitter.com/${embedHandle}`;
        container.innerHTML = `<a class="twitter-timeline" data-height="${height}" data-theme="${theme}" data-chrome="noheader nofooter" data-lang="tr" href="${embedUrl}?ref_src=twsrc%5Etfw">@${embedHandle}</a>`;
        twttr.widgets.load(container);
        setTimeout(() => {
          setStatus(container.querySelector('iframe') ? 'loaded' : 'error');
        }, 8000);
      }
    }).catch(() => {
      setStatus('error');
    });
  }, [embedHandle, listUrl, height, theme]);

  // Render when widgets.js is ready or handle changes
  useEffect(() => {
    onWidgetsReady(() => {
      renderTimeline();
    });
  }, [renderTimeline]);

  const currentAccount = FOOTBALL_ACCOUNTS.find(a => a.handle === selectedHandle);

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden bg-[#1e293b]">
      {/* Widgets.js Script — rendered once globally */}
      <TwitterWidgetsScript />

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
                onClick={() => setSelectedHandle(account.handle)}
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

      {/* Timeline Container */}
      <div className="relative" style={{ minHeight: height }}>
        {/* Loading overlay */}
        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 z-10 bg-[#1e293b]">
            <div className="w-8 h-8 border-2 border-[#1DA1F2] border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm">Twitter yükleniyor...</p>
          </div>
        )}

        {/* Error fallback */}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4 z-10 bg-[#1e293b]">
            <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current text-gray-600 mb-3" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <p className="text-gray-400 text-sm mb-3 text-center">Twitter embed yüklenemedi</p>
            <a
              href={`https://x.com/${embedHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-[#1DA1F2] text-white rounded-full text-sm hover:bg-[#1DA1F2]/80 transition-colors"
            >
              @{embedHandle} profilini X'te aç ↗
            </a>
            <div className="flex flex-wrap gap-2 justify-center max-w-xs mt-4">
              {FOOTBALL_ACCOUNTS.slice(0, 6).map(acc => (
                <a
                  key={acc.handle}
                  href={`https://x.com/${acc.handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-white/5 rounded-full text-xs text-gray-400 hover:bg-white/10 hover:text-[#1DA1F2] transition-colors"
                >
                  {acc.emoji} @{acc.handle}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Twitter embed renders here */}
        <div ref={containerRef} className="twitter-embed-container" />
      </div>
    </div>
  );
}

// Sidebar widget — compact with selector
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
