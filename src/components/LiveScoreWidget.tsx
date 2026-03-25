'use client';

import { useState, useEffect } from 'react';

// Simulated live match data (in production, you'd use a real API like api-football)
const MOCK_MATCHES = [
  {
    id: '1',
    league: 'Süper Lig',
    home: { name: 'Galatasaray', emoji: '🦁', score: 2 },
    away: { name: 'Fenerbahçe', emoji: '🐤', score: 1 },
    minute: 67,
    status: 'live' as const,
    events: ['⚽ 23\' Icardi', '⚽ 45\' Dzeko', '⚽ 51\' Icardi'],
  },
  {
    id: '2',
    league: 'Süper Lig',
    home: { name: 'Beşiktaş', emoji: '🦅', score: 0 },
    away: { name: 'Trabzonspor', emoji: '⭐', score: 0 },
    minute: 34,
    status: 'live' as const,
    events: [],
  },
  {
    id: '3',
    league: 'Süper Lig',
    home: { name: 'Başakşehir', emoji: '🏟️', score: 3 },
    away: { name: 'Antalyaspor', emoji: '🌴', score: 1 },
    minute: 90,
    status: 'finished' as const,
    events: ['⚽ 12\' Crivelli', '⚽ 29\' Visca', '⚽ 44\' Crivelli', '⚽ 78\' Podolski'],
  },
  {
    id: '4',
    league: 'Süper Lig',
    home: { name: 'Samsunspor', emoji: '🔴', score: null },
    away: { name: 'Konyaspor', emoji: '🟢', score: null },
    minute: 0,
    status: 'upcoming' as const,
    startTime: '21:00',
    events: [],
  },
];

export default function LiveScoreWidget() {
  const [matches, setMatches] = useState(MOCK_MATCHES);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Simulate minute changes for live matches
  useEffect(() => {
    const interval = setInterval(() => {
      setMatches(prev => prev.map(m => {
        if (m.status !== 'live') return m;
        const newMinute = Math.min(m.minute + 1, 90);
        return { ...m, minute: newMinute, status: newMinute >= 90 ? 'finished' as const : 'live' as const };
      }));
    }, 30000); // Every 30 sec = 1 game minute
    return () => clearInterval(interval);
  }, []);

  const liveCount = matches.filter(m => m.status === 'live').length;

  return (
    <div className="bg-[#1a1a2e] rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚽</span>
          <h3 className="text-sm font-bold text-white">Canlı Skorlar</h3>
        </div>
        {liveCount > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] text-red-400 font-bold">{liveCount} CANLI MAÇ</span>
          </div>
        )}
      </div>

      {/* Matches */}
      <div className="divide-y divide-white/5">
        {matches.map(match => (
          <button
            key={match.id}
            onClick={() => setExpandedId(expandedId === match.id ? null : match.id)}
            className="w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-colors"
          >
            {/* League & Status */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-gray-500">{match.league}</span>
              {match.status === 'live' && (
                <span className="flex items-center gap-1 text-[10px] text-red-400 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  {match.minute}&#39;
                </span>
              )}
              {match.status === 'finished' && (
                <span className="text-[10px] text-gray-500">MS</span>
              )}
              {match.status === 'upcoming' && (
                <span className="text-[10px] text-yellow-400">{match.startTime}</span>
              )}
            </div>

            {/* Score */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-sm">{match.home.emoji}</span>
                <span className="text-xs text-white font-medium truncate">{match.home.name}</span>
              </div>

              <div className="flex items-center gap-2 px-3 shrink-0">
                {match.status === 'upcoming' ? (
                  <span className="text-xs text-gray-500">vs</span>
                ) : (
                  <>
                    <span className={`text-lg font-black ${match.status === 'live' ? 'text-white' : 'text-gray-400'}`}>
                      {match.home.score}
                    </span>
                    <span className="text-gray-600 text-xs">-</span>
                    <span className={`text-lg font-black ${match.status === 'live' ? 'text-white' : 'text-gray-400'}`}>
                      {match.away.score}
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                <span className="text-xs text-white font-medium truncate">{match.away.name}</span>
                <span className="text-sm">{match.away.emoji}</span>
              </div>
            </div>

            {/* Expanded Events */}
            {expandedId === match.id && match.events.length > 0 && (
              <div className="mt-2 pt-2 border-t border-white/5">
                {match.events.map((event, idx) => (
                  <p key={idx} className="text-[10px] text-gray-400 py-0.5">{event}</p>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-white/10 bg-white/[0.02]">
        <p className="text-[10px] text-gray-600 text-center">
          Veriler simülasyon amaçlıdır
        </p>
      </div>
    </div>
  );
}
