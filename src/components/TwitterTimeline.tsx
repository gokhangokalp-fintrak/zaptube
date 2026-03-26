'use client';

import { useEffect, useRef, useState } from 'react';

// Türk futbol dünyasının popüler Twitter/X hesapları
const FOOTBALL_ACCOUNTS = [
  { handle: 'Fenerbahce', name: 'Fenerbahçe SK', team: 'fenerbahce', emoji: '💛💙' },
  { handle: 'GalsaraySK', name: 'Galatasaray SK', team: 'galatasaray', emoji: '🟡🔴' },
  { handle: 'Besiktas', name: 'Beşiktaş JK', team: 'besiktas', emoji: '⚫⚪' },
  { handle: 'Trabzonspor', name: 'Trabzonspor', team: 'trabzonspor', emoji: '🔵🟤' },
  { handle: 'TFF_Org', name: 'TFF', team: 'genel', emoji: '🇹🇷' },
  { handle: 'SuperLig', name: 'Süper Lig', team: 'genel', emoji: '⚽' },
  { handle: 'baboronaldo', name: 'Babür Çelik', team: 'genel', emoji: '🎙️' },
  { handle: 'NTV', name: 'NTV Spor', team: 'genel', emoji: '📰' },
];

interface TwitterTimelineProps {
  /** Specific handle to show, or 'all' for selector mode */
  handle?: string;
  /** Height of the timeline widget */
  height?: number;
  /** Dark or light theme */
  theme?: 'dark' | 'light';
  /** Show account selector */
  showSelector?: boolean;
  /** Compact mode for sidebar */
  compact?: boolean;
  /** Custom title */
  title?: string;
}

export default function TwitterTimeline({
  handle,
  height = 500,
  theme = 'dark',
  showSelector = false,
  compact = false,
  title,
}: TwitterTimelineProps) {
  const [selectedHandle, setSelectedHandle] = useState(handle || FOOTBALL_ACCOUNTS[0].handle);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Load Twitter widgets.js once
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if already loaded
    if ((window as any).twttr?.widgets) {
      setScriptLoaded(true);
      return;
    }

    // Check if script tag already exists
    const existingScript = document.querySelector('script[src*="platform.twitter.com/widgets.js"]');
    if (existingScript) {
      const checkLoaded = setInterval(() => {
        if ((window as any).twttr?.widgets) {
          setScriptLoaded(true);
          clearInterval(checkLoaded);
        }
      }, 100);
      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkLoaded);
        if (!(window as any).twttr?.widgets) {
          setLoadError(true);
        }
      }, 10000);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;
    script.charset = 'utf-8';
    script.onload = () => {
      const checkLoaded = setInterval(() => {
        if ((window as any).twttr?.widgets) {
          setScriptLoaded(true);
          clearInterval(checkLoaded);
        }
      }, 100);
      setTimeout(() => clearInterval(checkLoaded), 5000);
    };
    script.onerror = () => setLoadError(true);
    document.head.appendChild(script);
  }, []);

  // Render timeline when script is loaded or handle changes
  useEffect(() => {
    if (!scriptLoaded || !containerRef.current) return;

    const container = containerRef.current;
    // Clear previous timeline
    container.innerHTML = '';

    const twttr = (window as any).twttr;
    if (!twttr?.widgets?.createTimeline) {
      setLoadError(true);
      return;
    }

    twttr.widgets.createTimeline(
      {
        sourceType: 'profile',
        screenName: selectedHandle,
      },
      container,
      {
        height: height,
        theme: theme,
        chrome: compact ? 'noheader nofooter noborders transparent' : 'noheader nofooter',
        borderColor: '#1e293b',
        lang: 'tr',
        dnt: true,
      }
    ).catch(() => {
      // Fallback: use anchor + reload
      container.innerHTML = `
        <a class="twitter-timeline"
           href="https://twitter.com/${selectedHandle}"
           data-height="${height}"
           data-theme="${theme}"
           data-chrome="${compact ? 'noheader nofooter noborders transparent' : 'noheader nofooter'}"
           data-lang="tr"
           data-dnt="true">
          @${selectedHandle} yükleniyor...
        </a>
      `;
      twttr.widgets.load(container);
    });
  }, [scriptLoaded, selectedHandle, height, theme, compact]);

  const currentAccount = FOOTBALL_ACCOUNTS.find(a => a.handle === selectedHandle);

  return (
    <div className={`rounded-xl border border-white/10 overflow-hidden ${compact ? 'bg-transparent' : 'bg-[#1e293b]'}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 bg-[#111827]/80">
        <div className="flex items-center justify-between">
          <h3 className={`font-bold text-white flex items-center gap-2 ${compact ? 'text-sm' : 'text-base'}`}>
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-white" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            {title || (currentAccount ? `${currentAccount.emoji} ${currentAccount.name}` : 'Twitter Akışı')}
          </h3>
          {selectedHandle && (
            <a
              href={`https://x.com/${selectedHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-[#1DA1F2] transition-colors"
            >
              @{selectedHandle} ↗
            </a>
          )}
        </div>
      </div>

      {/* Account Selector */}
      {showSelector && (
        <div className="px-3 py-2 border-b border-white/10 bg-[#111827]/50">
          <div className="flex flex-wrap gap-1.5">
            {FOOTBALL_ACCOUNTS.map((account) => (
              <button
                key={account.handle}
                onClick={() => setSelectedHandle(account.handle)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
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
      <div className="relative">
        {!scriptLoaded && !loadError && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <div className="w-8 h-8 border-2 border-[#1DA1F2] border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm">Twitter yükleniyor...</p>
          </div>
        )}

        {loadError && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <svg viewBox="0 0 24 24" className="w-10 h-10 fill-current text-gray-600 mb-3" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <p className="text-gray-400 text-sm mb-2">Twitter timeline yüklenemedi</p>
            <a
              href={`https://x.com/${selectedHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1DA1F2] text-sm hover:underline"
            >
              @{selectedHandle} profiline git ↗
            </a>
          </div>
        )}

        <div
          ref={containerRef}
          className="twitter-timeline-container"
          style={{ minHeight: loadError ? 0 : height }}
        />
      </div>
    </div>
  );
}

// Compact version for sidebar/widgets
export function TwitterFeedWidget() {
  return (
    <TwitterTimeline
      showSelector={true}
      height={400}
      compact={true}
      title="Twitter Akışı"
    />
  );
}

export { FOOTBALL_ACCOUNTS };
