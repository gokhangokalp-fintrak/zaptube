'use client';

import { useState, useEffect } from 'react';
import sponsors from '@/data/sponsors.json';

interface PrerollAdProps {
  onComplete: () => void;
  sponsorSlot?: string;
}

export default function PrerollAd({ onComplete, sponsorSlot = 'preroll' }: PrerollAdProps) {
  const [timeRemaining, setTimeRemaining] = useState(5);
  const [showSkipButton, setShowSkipButton] = useState(false);

  const sponsor = sponsors.sponsors.find((s) => s.slot === sponsorSlot && s.active);

  useEffect(() => {
    if (!sponsor) {
      onComplete();
      return;
    }

    const skipTimer = setTimeout(() => {
      setShowSkipButton(true);
    }, 3000);

    return () => clearTimeout(skipTimer);
  }, [sponsor, onComplete]);

  useEffect(() => {
    if (!sponsor) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sponsor, onComplete]);

  if (!sponsor) {
    return null;
  }

  const progressPercentage = (timeRemaining / 5) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-fade-in">
      <div className="bg-slate-900 rounded-lg shadow-2xl p-8 max-w-md w-full border border-slate-700 animate-fade-in">
        <div className="text-center mb-6">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">
            ZapTube Sponsor
          </p>
          <div className="mb-6 flex justify-center">
            <img
              src={sponsor.image}
              alt={sponsor.name}
              className="h-16 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">{sponsor.name}</h2>
          <p className="text-gray-300 text-sm">{sponsor.tagline}</p>
        </div>

        <div className="mb-6">
          <div className="w-full bg-slate-700 rounded-full h-1 overflow-hidden">
            <div
              className="bg-blue-500 h-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="text-center text-gray-400 text-xs mt-2">
            {timeRemaining} saniye
          </p>
        </div>

        <a
          href={sponsor.link}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors mb-3 text-center"
        >
          Ziyaret Et
        </a>

        {showSkipButton && (
          <button
            onClick={onComplete}
            className="w-full text-gray-400 hover:text-white text-sm font-medium py-2 px-4 transition-colors animate-fade-in"
          >
            Reklamı Geç &gt;
          </button>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
