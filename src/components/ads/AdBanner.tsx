'use client';

import sponsors from '@/data/sponsors.json';

interface AdBannerProps {
  slot: 'sidebar' | 'player-bottom' | 'chat-top' | 'stats-inline' | 'preroll' | 'stream-bottom';
  className?: string;
}

export default function AdBanner({ slot, className = '' }: AdBannerProps) {
  if (slot === 'preroll') {
    return null;
  }

  const sponsor = sponsors.sponsors.find((s) => s.slot === slot && s.active)
    || sponsors.sponsors.find((s) => s.active); // fallback to any active sponsor

  // ========== STREAM BOTTOM — ince uzun banner, video altı ==========
  if (slot === 'stream-bottom') {
    return (
      <div
        className={`w-full rounded-lg overflow-hidden ${className}`}
        style={{
          background: 'linear-gradient(90deg, #0c1a2e 0%, #162033 30%, #1a2744 60%, #0f1b2e 100%)',
        }}
      >
        {sponsor ? (
          <a
            href={sponsor.link}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="flex items-center justify-between px-4 py-2 group hover:opacity-90 transition-opacity"
          >
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={sponsor.image}
                alt={sponsor.name}
                className="h-6 w-6 object-contain rounded"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <span className="text-xs font-bold text-white truncate">{sponsor.name}</span>
              <span className="text-[10px] text-gray-400 truncate hidden sm:inline">{sponsor.tagline}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[9px] text-gray-500 uppercase tracking-wider">Sponsor</span>
              <span className="text-xs text-blue-400 group-hover:text-blue-300 transition-colors">Ziyaret Et →</span>
            </div>
          </a>
        ) : (
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 bg-gray-700 rounded flex items-center justify-center">
                <span className="text-[8px] text-gray-400">AD</span>
              </div>
              <span className="text-xs text-gray-500">Reklam Alanı — Sponsor olun</span>
            </div>
            <span className="text-[9px] text-gray-600 uppercase tracking-wider">Reklam</span>
          </div>
        )}
      </div>
    );
  }

  if (!sponsor) {
    return (
      <div
        className={`flex items-center justify-center border-2 border-dashed border-gray-600 bg-slate-900 text-gray-400 rounded-lg ${className}`}
        style={{
          width: slot === 'sidebar' ? '100%' : '100%',
          height: slot === 'sidebar' ? '200px' : '70px',
          maxWidth: slot === 'sidebar' ? '300px' : '728px',
        }}
      >
        <div className="text-center">
          <p className="text-sm font-medium">Reklam Alanı</p>
          <p className="text-xs mt-1">Google AdSense</p>
        </div>
      </div>
    );
  }

  if (slot === 'sidebar') {
    return (
      <a
        href={sponsor.link}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className={`group block w-full max-w-[300px] relative overflow-hidden rounded-lg transition-transform hover:scale-[1.02] ${className}`}
        style={{
          background: `linear-gradient(135deg, #1e293b 0%, #334155 100%)`,
          aspectRatio: '300/250',
        }}
      >
        <div className="absolute inset-0 p-6 flex flex-col items-center justify-center">
          <div className="text-center">
            <img
              src={sponsor.image}
              alt={sponsor.name}
              className="w-24 h-24 object-contain mb-4 mx-auto"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <h3 className="text-white font-bold text-lg">{sponsor.name}</h3>
            <p className="text-gray-300 text-sm mt-2">{sponsor.tagline}</p>
          </div>
        </div>
        <div className="absolute top-2 right-2 bg-white text-slate-900 text-xs font-semibold px-2 py-1 rounded">
          Sponsor
        </div>
      </a>
    );
  }

  // Default horizontal banner (player-bottom, chat-top, stats-inline)
  return (
    <a
      href={sponsor.link}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={`group block w-full max-w-[728px] relative overflow-hidden rounded-lg transition-transform hover:scale-[1.01] ${className}`}
      style={{
        background: `linear-gradient(90deg, #1e293b 0%, #334155 100%)`,
        height: '70px',
      }}
    >
      <div className="absolute inset-0 px-6 flex items-center justify-between">
        <div>
          <img
            src={sponsor.image}
            alt={sponsor.name}
            className="h-12 object-contain"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
        <div className="text-right">
          <h3 className="text-white font-bold">{sponsor.name}</h3>
          <p className="text-gray-300 text-xs">{sponsor.tagline}</p>
        </div>
      </div>
      <div className="absolute top-1 right-2 bg-white text-slate-900 text-xs font-semibold px-2 py-0.5 rounded">
        Sponsor
      </div>
    </a>
  );
}
