'use client';

import { TopScorer } from '@/lib/sports-data';
import { useSportsData } from '@/lib/use-sports-data';

const MEDAL_EMOJIS = ['🥇', '🥈', '🥉'];

export default function TopScorersWidget() {
  const { data: allScorers, loading, isRealData } = useSportsData<TopScorer[]>({
    type: 'scorers',
  });
  const scorers = (allScorers || []).slice(0, 10);

  if (loading) {
    return (
      <div className="bg-[#1a1a2e] rounded-lg p-4 border border-[#2a2a3e]">
        <div className="h-64 flex items-center justify-center">
          <div className="text-gray-400">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  const topScorer = scorers[0];

  return (
    <div className="bg-[#1a1a2e] rounded-lg p-4 border border-[#2a2a3e] overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-bold text-white">⚽ Gol Krallığı</h2>
      </div>

      {/* Top Scorer Highlight */}
      {topScorer && (
        <div className="mb-4 pb-4 border-b border-[#2a2a3e]">
          <div className="relative bg-gradient-to-r from-yellow-600/20 to-yellow-400/10 rounded-lg p-3 border border-yellow-500/30">
            {/* Gold Bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-t-lg"></div>

            <div className="flex items-start gap-3 pt-1">
              <div className="text-3xl">{MEDAL_EMOJIS[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate">{topScorer.player}</div>
                <div className="text-xs text-gray-400">{topScorer.teamEmoji} {topScorer.team}</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-yellow-400">{topScorer.goals}</span>
                  <span className="text-xs text-gray-400">gol</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {topScorer.assists && `${topScorer.assists} asistin`}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0f0f23] z-10">
            <tr className="text-gray-400 border-b border-[#2a2a3e]">
              <th className="px-2 py-2 text-left font-semibold">#</th>
              <th className="px-2 py-2 text-left font-semibold">Oyuncu</th>
              <th className="px-2 py-2 text-center font-semibold text-[10px]">Takım</th>
              <th className="px-2 py-2 text-center font-semibold">G</th>
              <th className="px-2 py-2 text-center font-semibold">A</th>
              <th className="px-2 py-2 text-center font-semibold text-[10px]">dk/G</th>
            </tr>
          </thead>
          <tbody>
            {scorers.map((scorer, index) => {
              const isTurkish = scorer.nationality === 'Turkey' || scorer.nationality === 'Türkiye';
              const medal = MEDAL_EMOJIS[index] || (index + 1);

              return (
                <tr
                  key={`scorer-${index}`}
                  className={`border-b border-[#2a2a3e] hover:bg-[#252540] transition-colors ${
                    isTurkish ? 'bg-[#1a1a3e]/50' : ''
                  }`}
                >
                  <td className="px-2 py-2 text-center font-bold text-gray-300 w-8">
                    {index < 3 ? medal : index + 1}
                  </td>
                  <td className="px-2 py-2 text-left">
                    <div className="text-white font-semibold truncate">{scorer.player}</div>
                    <div className="text-[10px] text-gray-500">{scorer.nationality}</div>
                  </td>
                  <td className="px-2 py-2 text-center text-sm">{scorer.teamEmoji}</td>
                  <td className="px-2 py-2 text-center font-bold text-green-400">{scorer.goals}</td>
                  <td className="px-2 py-2 text-center text-gray-300">{scorer.assists || 0}</td>
                  <td className="px-2 py-2 text-center text-[10px] text-gray-400">
                    {scorer.minutesPerGoal ? Math.round(scorer.minutesPerGoal) : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-[#2a2a3e] text-[9px] text-gray-500">
        <div className="flex justify-between">
          <span>G = Gol</span>
          <span>A = Asist</span>
          <span>dk/G = Dakika/Gol</span>
        </div>
      </div>
    </div>
  );
}
