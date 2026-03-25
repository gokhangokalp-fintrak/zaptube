'use client';

import { getFixtures, Match } from '@/lib/sports-data';
import FixturesWidget from '@/components/FixturesWidget';
import MatchDetailPanel from '@/components/MatchDetailPanel';
import StandingsWidget from '@/components/StandingsWidget';
import TopScorersWidget from '@/components/TopScorersWidget';
import { useEffect, useState } from 'react';

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const data = await getFixtures();
        setMatches(data);

        // Auto-select first live match, or most recent finished, or next upcoming
        const liveMatch = data.find((m) => m.status === 'live');
        if (liveMatch) {
          setSelectedMatch(liveMatch);
        } else {
          const finishedMatches = data.filter((m) => m.status === 'finished');
          if (finishedMatches.length > 0) {
            setSelectedMatch(finishedMatches[finishedMatches.length - 1]);
          } else {
            const upcomingMatches = data.filter((m) => m.status === 'upcoming');
            if (upcomingMatches.length > 0) {
              setSelectedMatch(upcomingMatches[0]);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch matches:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, []);

  const liveMatchCount = matches.filter((m) => m.status === 'live').length;

  return (
    <div className="min-h-screen bg-[#0f0f23] text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a1a2e] to-[#0f0f23] border-b border-[#2a2a3e] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                ⚽ Maç Merkezi
              </h1>
            </div>
            {liveMatchCount > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-600/20 border border-red-500/50 rounded-lg">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                <span className="text-sm font-semibold text-red-400">
                  {liveMatchCount} Canlı Maç
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-gray-400 text-lg">Maçlar yükleniyor...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Content - Featured Match & Fixtures */}
            <div className="lg:col-span-3 space-y-6">
              {/* Featured Match Detail */}
              {selectedMatch && (
                <div className="bg-[#1a1a2e] rounded-lg border border-[#2a2a3e] overflow-hidden">
                  <MatchDetailPanel match={selectedMatch} />
                </div>
              )}

              {/* Fixtures Widget */}
              <FixturesWidget />
            </div>

            {/* Right Sidebar */}
            <div className="lg:col-span-1 space-y-6 h-fit sticky top-24">
              {/* Standings */}
              <StandingsWidget />

              {/* Top Scorers */}
              <TopScorersWidget />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
