'use client';

import { Match } from '@/lib/sports-data';

interface MatchDetailPanelProps {
  match: Match;
}

export default function MatchDetailPanel({ match }: MatchDetailPanelProps) {
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';

  return (
    <div className="bg-[#1a1a2e] rounded-lg border border-[#2a2a3e] p-6 space-y-6">
      {/* Score Display */}
      <div className="space-y-4">
        {/* Teams and Score */}
        <div className="flex items-center justify-between gap-4">
          {/* Home Team */}
          <div className="flex-1 text-center">
            <div className="text-4xl mb-2">{match.home.emoji}</div>
            <h3 className="text-lg font-bold text-white mb-2">{match.home.name}</h3>
          </div>

          {/* Score */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-4">
              <div className="text-5xl font-bold text-white w-16 text-center">{match.home.score ?? '-'}</div>
              <div className="text-2xl text-gray-400">-</div>
              <div className="text-5xl font-bold text-white w-16 text-center">{match.away.score ?? '-'}</div>
            </div>
          </div>

          {/* Away Team */}
          <div className="flex-1 text-center">
            <div className="text-4xl mb-2">{match.away.emoji}</div>
            <h3 className="text-lg font-bold text-white mb-2">{match.away.name}</h3>
          </div>
        </div>

        {/* Status Bar */}
        <div className="bg-[#0f0f23] rounded-lg p-4 border border-[#2a2a3e]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {isLive && (
                <>
                  <span className="inline-block w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
                  <span className="text-lg font-bold text-red-400">CANLI - {match.minute}&apos;</span>
                </>
              )}
              {isFinished && <span className="text-lg font-bold text-gray-300">MAÇ SONU</span>}
              {!isLive && !isFinished && (
                <span className="text-sm text-gray-400">
                  {match.time}
                </span>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {isLive && (
            <div className="w-full bg-[#2a2a3e] h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-red-500 to-red-600 h-full transition-all"
                style={{ width: `${Math.min((match.minute || 0) / 90 * 100, 100)}%` }}
              ></div>
            </div>
          )}
        </div>
      </div>

      {/* Match Events Timeline */}
      {match.events && match.events.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-white">Maç Olayları</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {match.events
              .sort((a, b) => b.minute - a.minute)
              .map((event, idx) => {
                const getEventIcon = () => {
                  switch (event.type) {
                    case 'goal': return '⚽';
                    case 'yellow': return '🟨';
                    case 'red': return '🟥';
                    case 'sub': return '🔄';
                    case 'var': return '📺';
                    case 'penalty': return '⚽🅿️';
                    case 'own_goal': return '⚽🔴';
                    default: return '•';
                  }
                };

                const isHomeEvent = event.team === 'home';

                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 p-2 rounded text-sm border border-transparent ${
                      isHomeEvent ? 'bg-[#1a3a1a]/50' : 'bg-[#3a1a1a]/50'
                    }`}
                  >
                    <span className="text-gray-400 min-w-12 text-right">{event.minute}&apos;</span>
                    <span className="text-xl">{getEventIcon()}</span>
                    <div className="flex-1">
                      <div className="font-semibold text-white">{event.player}</div>
                      {event.detail && (
                        <div className="text-xs text-gray-400">{event.detail}</div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Match Stats */}
      {match.stats && (
        <div className="space-y-4 border-t border-[#2a2a3e] pt-4">
          <h4 className="text-sm font-bold text-white">İstatistikler</h4>
          <div className="space-y-3">
            <StatBar label="Topa Sahip Olma" homeStat={match.stats.possession[0]} awayStat={match.stats.possession[1]} unit="%" />
            <StatBar label="Şut" homeStat={match.stats.shots[0]} awayStat={match.stats.shots[1]} />
            <StatBar label="Hedefi Bulan Şut" homeStat={match.stats.shotsOnTarget[0]} awayStat={match.stats.shotsOnTarget[1]} />
            <StatBar label="Köşe Vuruşu" homeStat={match.stats.corners[0]} awayStat={match.stats.corners[1]} />
            <StatBar label="Faut" homeStat={match.stats.fouls[0]} awayStat={match.stats.fouls[1]} />
            <StatBar label="Ofsayt" homeStat={match.stats.offsides[0]} awayStat={match.stats.offsides[1]} />
            <StatBar label="Pas" homeStat={match.stats.passes[0]} awayStat={match.stats.passes[1]} />
            <StatBar label="Pas İsabeti" homeStat={match.stats.passAccuracy[0]} awayStat={match.stats.passAccuracy[1]} unit="%" />
          </div>
        </div>
      )}

      {/* Stadium Info */}
      {match.stadium && (
        <div className="bg-[#0f0f23] rounded-lg p-4 border border-[#2a2a3e] text-sm text-gray-300">
          <div className="font-semibold text-white mb-1">🏟️ Stadyum</div>
          <div>{match.stadium}</div>
        </div>
      )}
    </div>
  );
}

interface StatBarProps {
  label: string;
  homeStat: number;
  awayStat: number;
  unit?: string;
}

function StatBar({ label, homeStat, awayStat, unit = '' }: StatBarProps) {
  const total = homeStat + awayStat;
  const homePercent = total > 0 ? (homeStat / total) * 100 : 50;
  const awayPercent = 100 - homePercent;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-xs font-semibold text-white min-w-8 text-right">
          {homeStat}{unit}
        </div>
        <div className="flex-1 flex gap-0.5 h-2 rounded-full overflow-hidden bg-[#0f0f23]">
          <div
            className="bg-gradient-to-r from-blue-600 to-blue-500 transition-all"
            style={{ width: `${homePercent}%` }}
          ></div>
          <div
            className="bg-gradient-to-r from-orange-600 to-orange-500 transition-all"
            style={{ width: `${awayPercent}%` }}
          ></div>
        </div>
        <div className="text-xs font-semibold text-white min-w-8 text-left">
          {awayStat}{unit}
        </div>
      </div>
    </div>
  );
}
