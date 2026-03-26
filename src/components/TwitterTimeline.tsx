'use client';

import { useEffect, useRef, useState } from 'react';

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
  const [iframeKey, setIframeKey] = useState(0);

  // The embed URL - either a list or a profile
  const embedHandle = handle || selectedHandle;

  // Update when handle prop changes
  useEffect(() => {
    if (handle) setSelectedHandle(handle);
  }, [handle]);

  // Build iframe src for the standalone embed page
  const iframeSrc = listUrl
    ? `/twitter-embed.html?list=${encodeURIComponent(listUrl)}&theme=${theme}&height=${height}`
    : `/twitter-embed.html?handle=${embedHandle}&theme=${theme}&height=${height}`;

  const currentAccount = FOOTBALL_ACCOUNTS.find(a => a.handle === selectedHandle);

  return (
    <div className={`rounded-xl border border-white/10 overflow-hidden bg-[#1e293b]`}>
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
                  setIframeKey(prev => prev + 1);
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

      {/* Timeline via iframe — isolated from React DOM */}
      <iframe
        key={`${embedHandle}-${iframeKey}`}
        src={iframeSrc}
        style={{
          width: '100%',
          height: height,
          border: 'none',
          backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
        }}
        title={`Twitter Timeline - @${embedHandle}`}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        loading="lazy"
      />
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
