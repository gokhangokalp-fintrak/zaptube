'use client';

import { useState } from 'react';
import { useSportsData } from '@/lib/use-sports-data';

interface LiveMatch {
  id: number;
  home: { name: string; shortName: string; logo?: string; score: number | null };
  away: { name: string; shortName: string; logo?: string; score: number | null };
  status: 'upcoming' | 'live' | 'halftime' | 'finished';
  minute: number | null;
  date: string;
  stadium: string;
  league: string;
  events: { minute: number; type: string; player: string; team: string; detail?: string }[];
}

export default function LiveScoreWidget() {
  const { data: matches, loading } = useSportsData<LiveMatch[]>({
    type: 'live',
    refreshInterval: 120000, // 2 dakikada bir yenile
  });

  const [expandedId, setExpandedId] = useState<number | null>(null);

  const liveMatches = Array.isArray(matches) ? matches : [];
  const liveCount = liveMatches.filter(m => m.status === 'live' || m.status === 'halftime').length;

  return (
    <div className="bg-[#1a1a2e] rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚽</span>
          <h3 className="text-sm font-bold text-white">Canlı Skorlar</h3>
          {liveCount > 0 && (
            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-bold">CANLI</span>
          )}
        </div>
        {liveCount > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] text-red-400 font-bold">{liveCount} MAÇ</span>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-6 text-center">
          <div className="text-gray-500 text-xs animate-pulse">Yükleniyor...</div>
        </div>
      ) : liveMatches.length === 0 ? (
        <div className="p-6 text-center">
          <div className="text-2xl mb-2 opacity-40">📡</div>
          <p className="text-xs text-gray-500">Şu an canlı maç yok</p>
          <p className="text-[10px] text-gray-600 mt-1">Maç günü skorlar burada görünecek</p>
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {liveMatches.map(match => (
            <button
              key={match.id}
              onClick={() => setExpandedId(expandedId === match.id ? null : match.id)}
              className="w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-colors"
            >
              {/* Status */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-gray-500">{match.league}</span>
                {(match.status === 'live' || match.status === 'halftime') && (
                  <span className="flex items-center gap-1 text-[10px] text-red-400 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    {match.status === 'halftime' ? 'D.Arası' : `${match.minute}'`}
                  </span>
                )}
                {match.status === 'finished' && (
                  <span className="text-[10px] text-gray-500">MS</span>
                )}
              </div>

              {/* Score */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {match.home.logo && (
                    <img src={match.home.logo} alt="" className="w-5 h-5 object-contain" />
                  )}
                  <span className="text-xs text-white font-medium truncate">{match.home.shortName || match.home.name}</span>
                </div>

                <div className="flex items-center gap-2 px-3 shrink-0">
                  <span className={`text-lg font-black ${match.status === 'live' ? 'text-white' : 'text-gray-400'}`}>
                    {match.home.score ?? '-'}
                  </span>
                  <span className="text-gray-600 text-xs">-</span>
                  <span className={`text-lg font-black ${match.status === 'live' ? 'text-white' : 'text-gray-400'}`}>
                    {match.away.score ?? '-'}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                  <span className="text-xs text-white font-medium truncate">{match.away.shortName || match.away.name}</span>
                  {match.away.logo && (
                    <img src={match.away.logo} alt="" className="w-5 h-5 object-contain" />
                  )}
                </div>
              </div>

              {/* Expanded Events */}
              {expandedId === match.id && match.events && match.events.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/5">
                  {match.events
                    .filter(e => e.type === 'goal' || e.type === 'penalty' || e.type === 'own_goal')
                    .map((event, idx) => (
                    <p key={idx} className="text-[10px] text-gray-400 py-0.5">
                      {event.type === 'goal' && '⚽'}
                      {event.type === 'penalty' && '⚽🅿️'}
                      {event.type === 'own_goal' && '⚽🔴'}
                      {' '}{event.minute}&apos; {event.player}
                    </p>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 border-t border-white/10 bg-white/[0.02]">
        <p className="text-[10px] text-gray-600 text-center">
{'API-Football · Her 2 dk güncellenir'}
        </p>
      </div>
    </div>
  );
}
