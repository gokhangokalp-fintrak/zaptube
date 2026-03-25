'use client';

import { TeamStanding } from '@/lib/sports-data';
import { useSportsData } from '@/lib/use-sports-data';

interface StandingsWidgetProps {
  selectedTeamId?: string;
}

export default function StandingsWidget({ selectedTeamId }: StandingsWidgetProps) {
  const { data: standings, loading, isRealData } = useSportsData<TeamStanding[]>({
    type: 'standings',
  });

  const getLeftBorderColor = (position: number) => {
    if (position === 1) return 'border-l-4 border-l-yellow-400'; // Champions
    if (position >= 2 && position <= 3) return 'border-l-4 border-l-blue-500'; // CL
    if (position === 4) return 'border-l-4 border-l-cyan-400'; // Conference
    if (position >= 17) return 'border-l-4 border-l-red-500'; // Relegation
    return '';
  };

  if (loading) {
    return (
      <div className="bg-[#1a1a2e] rounded-lg p-4 border border-[#2a2a3e]">
        <div className="h-96 flex items-center justify-center">
          <div className="text-gray-400">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a2e] rounded-lg p-4 border border-[#2a2a3e] overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-bold text-white mb-1">🏆 Puan Durumu</h2>
        <p className="text-xs text-gray-400">
          Süper Lig 2025-26
          {isRealData && <span className="ml-2 text-green-400 text-[8px]">● CANLI</span>}
        </p>
      </div>

      {/* Table */}
      <div className="overflow-y-auto flex-1">
        <table className="w-full text-[10px] sm:text-xs">
          <thead className="sticky top-0 bg-[#0f0f23]">
            <tr className="text-gray-400 border-b border-[#2a2a3e]">
              <th className="px-1 py-2 text-left font-semibold">#</th>
              <th className="px-2 py-2 text-left font-semibold">Takım</th>
              <th className="px-1 py-2 text-center font-semibold">O</th>
              <th className="px-1 py-2 text-center font-semibold">G</th>
              <th className="px-1 py-2 text-center font-semibold">B</th>
              <th className="px-1 py-2 text-center font-semibold">M</th>
              <th className="px-1 py-2 text-center font-semibold">AG</th>
              <th className="px-1 py-2 text-center font-semibold">YG</th>
              <th className="px-1 py-2 text-center font-semibold">Av</th>
              <th className="px-1 py-2 text-center font-semibold">P</th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(standings) ? standings : []).map((team, index) => {
              const isSelected = selectedTeamId === team.shortName;
              const borderClass = getLeftBorderColor(index + 1);

              return (
                <tr
                  key={team.shortName}
                  className={`border-b border-[#2a2a3e] hover:bg-[#252540] transition-colors ${borderClass} ${
                    isSelected ? 'bg-[#252540]' : ''
                  }`}
                >
                  <td className="px-1 py-2 text-gray-300 font-semibold">{index + 1}</td>
                  <td className="px-2 py-2 text-left">
                    <span className="text-sm">{team.emoji}</span>
                    <span className="ml-1 text-gray-200">{team.shortName}</span>
                  </td>
                  <td className="px-1 py-2 text-center text-gray-300">{team.played}</td>
                  <td className="px-1 py-2 text-center text-green-400 font-semibold">{team.won}</td>
                  <td className="px-1 py-2 text-center text-yellow-400 font-semibold">{team.drawn}</td>
                  <td className="px-1 py-2 text-center text-red-400 font-semibold">{team.lost}</td>
                  <td className="px-1 py-2 text-center text-gray-300">{team.goalsFor}</td>
                  <td className="px-1 py-2 text-center text-gray-300">{team.goalsAgainst}</td>
                  <td className="px-1 py-2 text-center text-gray-400">{team.goalDifference > 0 ? '+' : ''}{team.goalDifference}</td>
                  <td className="px-1 py-2 text-center text-white font-bold">{team.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Form Legend */}
      <div className="mt-3 pt-3 border-t border-[#2a2a3e] text-[9px] text-gray-400 space-y-1">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>
          <span>Galibiyet</span>
          <span className="inline-block w-3 h-3 rounded-full bg-yellow-500 ml-2"></span>
          <span>Beraberlik</span>
          <span className="inline-block w-3 h-3 rounded-full bg-red-500 ml-2"></span>
          <span>Yenilgi</span>
        </div>
      </div>
    </div>
  );
}
