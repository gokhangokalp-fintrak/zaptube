'use client';

import sponsors from '@/data/sponsors.json';

interface AdBannerProps {
  slot: 'sidebar' | 'player-bottom' | 'chat-top' | 'stats-inline' | 'preroll';
  className?: string;
}

export default function AdBanner({ slot, className = '' }: AdBannerProps) {
  if (slot === 'preroll') {
    return null;
  }

  const sponsor = sponsors.sponsors.find((s) => s.slot === slot && s.active);

  if (!sponsor) {
    return (
      <div
        className={`flex items-center justify-center border-2 border-dashed border-gray-600 bg-slate-900 text-gray-400 ${className}`}
        style={{
          width: slot === 'sidebar' ? '300px' : '728px',
          height: slot === 'sidebar' ? '250px' : '90px',
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
        className={`group block w-[300px] h-[250px] relative overflow-hidden rounded-lg transition-transform hover:scale-105 ${className}`}
        style={{
          background: `linear-gradient(135deg, #1e293b 0%, #334155 100%)`,
        }}
      >
        <div className="absolute inset-0 p-6 flex flex-col items-center justify-center">
          <div className="text-center">
            <img
              src={sponsor.image}
              alt={sponsor.name}
              className="w-24 h-24 object-contain mb-4 mx-auto"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
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

  return (
    <a
      href={sponsor.link}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={`group block w-[728px] h-[90px] relative overflow-hidden rounded-lg transition-transform hover:scale-105 ${className}`}
      style={{
        background: `linear-gradient(90deg, #1e293b 0%, #334155 100%)`,
      }}
    >
      <div className="absolute inset-0 px-6 flex items-center justify-between">
        <div>
          <img
            src={sponsor.image}
            alt={sponsor.name}
            className="h-12 object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
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
