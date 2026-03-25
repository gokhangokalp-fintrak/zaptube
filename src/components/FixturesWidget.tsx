'use client';

import { formatMatchDate, Match } from '@/lib/sports-data';
import { useState } from 'react';
import { useSportsData } from '@/lib/use-sports-data';

interface GroupedMatches {
  [date: string]: Match[];
}

type TabType = 'upcoming' | 'finished';

export default function FixturesWidget() {
  const { data: matches, loading } = useSportsData<Match[]>({
    type: 'fixtures',
  });
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);

  const allMatches = Array.isArray(matches) ? matches : [];
  const now = new Date();
  const upcomingMatches = allMatches.filter((m) => m.status === 'upcoming');
  const finishedMatches = allMatches.filter((m) => m.status === 'finished');
  const liveMatches = allMatches.filter((m) => m.status === 'live' || m.status === 'halftime');

  const displayMatches = activeTab === 'upcoming' ? upcomingMatches : finishedMatches;
  const grouped = displayMatches.reduce((acc, match) => {
    const dateKey = formatMatchDate(match.date);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(match);
    return acc;
  }, {} as GroupedMatches);

  if (loading) {
    return (
      <div className="bg-[#1a1a2e] rounded-lg p-4 border border-[#2a2a3e]">
        <div className="h-64 flex items-center justify-center">
          <div className="text-gray-400">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a2e] rounded-lg border border-[#2a2a3e] overflow-hidden flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-[#2a2a3e] bg-[#0f0f23]">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'upcoming'
              ? 'text-white border-b-2 border-b-blue-500 bg-[#1a1a2e]'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          📅 Yaklaşan Maçlar
          {liveMatches.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-xs font-bold animate-pulse">
              {liveMatches.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('finished')}
          className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'finished'
              ? 'text-white border-b-2 border-b-blue-500 bg-[#1a1a2e]'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          ✓ Son Sonuçlar
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 overflow-y-auto flex-1 max-h-96">
        {/* Live Matches First */}
        {activeTab === 'upcoming' && liveMatches.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-red-400 mb-2">🔴 CANLI</h3>
            {liveMatches.map((match) => (
              <MatchCard key={match.id} match={match} isLive={true} />
            ))}
          </div>
        )}

        {/* Grouped by Date */}
        {Object.entries(grouped).length > 0 ? (
          <div className="space-y-4">
            {Object.entries(grouped).map(([dateKey, dateMatches]) => (
              <div key={dateKey}>
                <div className="text-xs font-bold text-gray-400 mb-2 pb-2 border-b border-[#2a2a3e]">
                  {dateKey} • {dateMatches[0].week}. Hafta
                </div>
                <div className="space-y-2">
                  {dateMatches.map((match) => (
                    <div key={match.id}>
                      <button
                        onClick={() =>
                          setExpandedMatch(expandedMatch === match.id ? null : match.id)
                        }
                        className="w-full"
                      >
                        <MatchCard match={match} isLive={false} />
                      </button>

                      {/* Expanded Events */}
                      {expandedMatch === match.id && match.events && match.events.length > 0 && (
                        <div className="mt-2 ml-2 pl-3 border-l-2 border-blue-500 text-[10px] text-gray-300 space-y-1">
                          {match.events
                            .sort((a, b) => a.minute - b.minute)
                            .map((event, idx) => (
                              <div key={idx} className="flex gap-2">
                                <span className="text-gray-500 min-w-6">{event.minute}&apos;</span>
                                <span className="flex-1">
                                  {event.type === 'goal' && '⚽'}
                                  {event.type === 'yellow' && '🟨'}
                                  {event.type === 'red' && '🟥'}
                                  {event.type === 'sub' && '🔄'}
                                  {event.type === 'var' && '📺'}
                                  {' '}
                                  {event.player}
                                </span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 text-sm">
            {activeTab === 'upcoming' ? 'Yaklaşan maç yok' : 'Sonuç yok'}
          </div>
        )}
      </div>
    </div>
  );
}

interface MatchCardProps {
  match: Match;
  isLive?: boolean;
}

function MatchCard({ match, isLive = false }: MatchCardProps) {
  return (
    <div
      className={`p-3 rounded-lg border transition-all ${
        isLive
          ? 'border-red-500 border-2 bg-red-900/20 shadow-lg shadow-red-500/20'
          : 'border-[#2a2a3e] bg-[#0f0f23] hover:bg-[#1a1a3e]'
      }`}
    >
      {/* Match Scores */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex-1 flex items-center gap-2">
          <span className="text-sm">{match.home.emoji}</span>
          <span className="text-xs font-semibold text-white flex-1 text-left">
            {match.home.shortName}
          </span>
        </div>

        <div className="flex items-center gap-2 px-3">
          {match.status === 'live' ? (
            <>
              <span className="text-lg font-bold text-white">{match.home.score ?? 0}</span>
              <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              <span className="text-sm font-bold text-red-400">{match.minute}&apos;</span>
              <span className="text-lg font-bold text-white">{match.away.score ?? 0}</span>
            </>
          ) : match.status === 'finished' ? (
            <>
              <span className="text-lg font-bold text-white">{match.home.score ?? 0}</span>
              <span className="text-lg font-bold text-white">-</span>
              <span className="text-lg font-bold text-white">{match.away.score ?? 0}</span>
              <span className="text-xs font-bold text-gray-400 ml-2">MS</span>
            </>
          ) : (
            <span className="text-xs text-gray-400">{match.time}</span>
          )}
        </div>

        <div className="flex-1 flex items-center justify-end gap-2">
          <span className="text-xs font-semibold text-white text-right flex-1">
            {match.away.shortName}
          </span>
          <span className="text-sm">{match.away.emoji}</span>
        </div>
      </div>

      {/* Additional Info */}
      <div className="text-[10px] text-gray-400 flex gap-2 justify-between">
        {match.status === 'live' ? (
          <>
            <span>{match.stadium}</span>
            <div className="w-32 bg-[#2a2a3e] h-1 rounded-full overflow-hidden">
              <div
                className="bg-red-500 h-full transition-all"
                style={{ width: `${Math.min((match.minute || 0) / 90 * 100, 100)}%` }}
              ></div>
            </div>
          </>
        ) : (
          <>
            <span>{match.stadium}</span>
            <span>{match.time}</span>
          </>
        )}
      </div>
    </div>
  );
}
