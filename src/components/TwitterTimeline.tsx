'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// Türk futbol dünyasının popüler Twitter/X hesapları
const FOOTBALL_ACCOUNTS = [
  { handle: 'Fenerbahce', name: 'Fenerbahçe SK', team: 'fenerbahce', emoji: '💛💙' },
  { handle: 'GalatasaraySK', name: 'Galatasaray SK', team: 'galatasaray', emoji: '🟡🔴' },
  { handle: 'Besiktas', name: 'Beşiktaş JK', team: 'besiktas', emoji: '⚫⚪' },
  { handle: 'Trabzonspor', name: 'Trabzonspor', team: 'trabzonspor', emoji: '🔵🟤' },
  { handle: 'TFF_Org', name: 'TFF', team: 'genel', emoji: '🇹🇷' },
  { handle: 'superaborlig', name: 'Süper Lig', team: 'genel', emoji: '⚽' },
  { handle: 'NTVSpor', name: 'NTV Spor', team: 'genel', emoji: '📰' },
  { handle: 'ASpor', name: 'A Spor', team: 'genel', emoji: '📺' },
];

interface TwitterTimelineProps {
  handle?: string;
  height?: number;
  theme?: 'dark' | 'light';
  showSelector?: boolean;
  compact?: boolean;
  title?: string;
}

// Global script loading state
let widgetScriptStatus: 'idle' | 'loading' | 'loaded' | 'error' = 'idle';
const widgetLoadCallbacks: (() => void)[] = [];

function loadWidgetScript(onReady: () => void) {
  if (typeof window === 'undefined') return;

  if ((window as any).twttr?.widgets) {
    widgetScriptStatus = 'loaded';
    onReady();
    return;
  }

  if (widgetScriptStatus === 'loaded') {
    onReady();
    return;
  }

  widgetLoadCallbacks.push(onReady);

  if (widgetScriptStatus === 'loading') return;

  widgetScriptStatus = 'loading';

  const script = document.createElement('script');
  script.src = 'https://platform.twitter.com/widgets.js';
  script.async = true;
  script.charset = 'utf-8';

  script.onload = () => {
    // Wait for twttr to be ready
    const check = setInterval(() => {
      if ((window as any).twttr?.widgets) {
        clearInterval(check);
        widgetScriptStatus = 'loaded';
        widgetLoadCallbacks.forEach(cb => cb());
        widgetLoadCallbacks.length = 0;
      }
    }, 50);

    setTimeout(() => {
      clearInterval(check);
      if (widgetScriptStatus !== 'loaded') {
        widgetScriptStatus = 'error';
        widgetLoadCallbacks.forEach(cb => cb());
        widgetLoadCallbacks.length = 0;
      }
    }, 8000);
  };

  script.onerror = () => {
    widgetScriptStatus = 'error';
    widgetLoadCallbacks.forEach(cb => cb());
    widgetLoadCallbacks.length = 0;
  };

  document.head.appendChild(script);
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
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [useIframe, setUseIframe] = useState(false);
  const renderKey = useRef(0);

  // Update selectedHandle when handle prop changes
  useEffect(() => {
    if (handle) setSelectedHandle(handle);
  }, [handle]);

  // Render the timeline
  const renderTimeline = useCallback(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    renderKey.current++;
    const currentRender = renderKey.current;

    // Clear previous content
    container.innerHTML = '';

    // If widget script failed, use iframe
    if (widgetScriptStatus === 'error') {
      setUseIframe(true);
      setStatus('ready');
      return;
    }

    // Create anchor element for Twitter to render into
    const anchor = document.createElement('a');
    anchor.className = 'twitter-timeline';
    anchor.setAttribute('data-height', String(height));
    anchor.setAttribute('data-theme', theme);
    anchor.setAttribute('data-chrome', 'noheader nofooter');
    anchor.setAttribute('data-lang', 'tr');
    anchor.setAttribute('data-dnt', 'true');
    anchor.href = `https://twitter.com/${selectedHandle}`;
    anchor.textContent = `@${selectedHandle} tweetleri yükleniyor...`;
    container.appendChild(anchor);

    // Ask Twitter to render the widget
    const twttr = (window as any).twttr;
    if (twttr?.widgets?.load) {
      twttr.widgets.load(container).then(() => {
        if (currentRender !== renderKey.current) return;
        // Check if Twitter actually rendered something
        setTimeout(() => {
          if (currentRender !== renderKey.current) return;
          const iframe = container.querySelector('iframe');
          if (iframe) {
            setStatus('ready');
          } else {
            // Twitter widget didn't render — fallback to iframe
            setUseIframe(true);
            setStatus('ready');
          }
        }, 3000);
      }).catch(() => {
        if (currentRender !== renderKey.current) return;
        setUseIframe(true);
        setStatus('ready');
      });
    } else {
      setUseIframe(true);
      setStatus('ready');
    }
  }, [selectedHandle, height, theme]);

  // Load script and render
  useEffect(() => {
    setStatus('loading');
    setUseIframe(false);

    loadWidgetScript(() => {
      renderTimeline();
    });
  }, [renderTimeline]);

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

      {/* Timeline Content */}
      <div className="relative" style={{ minHeight: height }}>
        {/* Loading spinner */}
        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 z-10">
            <div className="w-8 h-8 border-2 border-[#1DA1F2] border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm">Twitter yükleniyor...</p>
          </div>
        )}

        {/* Iframe fallback */}
        {useIframe ? (
          <iframe
            src={`https://syndication.twitter.com/srv/timeline-profile/screen-name/${selectedHandle}?dnt=true&embedId=twitter-widget-0&frame=false&hideBorder=true&hideFooter=true&hideHeader=true&hideScrollBar=false&lang=tr&theme=${theme}`}
            style={{
              width: '100%',
              height: height,
              border: 'none',
              overflow: 'hidden',
              colorScheme: theme === 'dark' ? 'dark' : 'light',
            }}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            title={`@${selectedHandle} Twitter Timeline`}
          />
        ) : (
          /* Normal Twitter widget container */
          <div ref={containerRef} />
        )}
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
