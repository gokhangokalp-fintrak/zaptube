'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import channelData from '@/data/channels.json';
import { ChannelData, ChannelStats } from '@/types';
import { formatViewCount } from '@/lib/youtube';

const data = channelData as ChannelData;

type SortKey = 'subscribers' | 'views' | 'videos' | 'engagement';

function formatNumber(num: string): string {
  const n = parseInt(num);
  if (isNaN(n)) return num;
  return n.toLocaleString('tr-TR');
}

function calcEngagement(stats: ChannelStats): number {
  const views = parseInt(stats.viewCount) || 0;
  const subs = parseInt(stats.subscriberCount) || 1;
  const videos = parseInt(stats.videoCount) || 1;
  // Average views per video / subscribers * 100
  return ((views / videos) / subs) * 100;
}

function getRankBadge(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

function BarChart({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState<ChannelStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('subscribers');
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  // Fetch channel stats
  useEffect(() => {
    const ytIds = data.channels.map((ch) => ch.youtubeChannelId).join(',');
    fetch(`/api/channel-stats?channelIds=${ytIds}`)
      .then((r) => r.json())
      .then((d) => setStats(d.stats || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Filter by team
  const filteredStats = useMemo(() => {
    if (!selectedTeam || selectedTeam === 'genel') return stats;
    const teamChannelIds = data.channels
      .filter((ch) => ch.teams.includes(selectedTeam))
      .map((ch) => ch.youtubeChannelId);
    return stats.filter((s) => teamChannelIds.includes(s.channelId));
  }, [stats, selectedTeam]);

  // Sort
  const sortedStats = useMemo(() => {
    return [...filteredStats].sort((a, b) => {
      switch (sortKey) {
        case 'subscribers':
          return parseInt(b.subscriberCount) - parseInt(a.subscriberCount);
        case 'views':
          return parseInt(b.viewCount) - parseInt(a.viewCount);
        case 'videos':
          return parseInt(b.videoCount) - parseInt(a.videoCount);
        case 'engagement':
          return calcEngagement(b) - calcEngagement(a);
        default:
          return 0;
      }
    });
  }, [filteredStats, sortKey]);

  // Max values for bar charts
  const maxSubs = Math.max(...sortedStats.map((s) => parseInt(s.subscriberCount) || 0), 1);
  const maxViews = Math.max(...sortedStats.map((s) => parseInt(s.viewCount) || 0), 1);
  const maxVideos = Math.max(...sortedStats.map((s) => parseInt(s.videoCount) || 0), 1);
  const maxEng = Math.max(...sortedStats.map((s) => calcEngagement(s)), 1);

  // ZapTube mock stats
  const getZapStats = (channelId: string) => {
    const ch = data.channels.find((c) => c.youtubeChannelId === channelId);
    const seed = (ch?.name || '').length * 1337;
    return {
      zapViews: Math.floor((seed % 5000) + 500),
      zapFollowers: Math.floor((seed % 200) + 20),
      zapFavorites: Math.floor((seed % 50) + 3),
      zapEngagement: parseFloat(((seed % 80) / 10 + 2).toFixed(1)),
    };
  };

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5" style={{ background: 'rgba(17,24,39,0.95)', backdropFilter: 'blur(8px)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/app" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <span className="text-xl">📺</span>
              <h1 className="text-base font-bold tracking-tight">
                <span className="bg-gradient-to-r from-red-500 to-emerald-400 bg-clip-text text-transparent">Zap</span>Tube
              </h1>
            </Link>
            <nav className="flex items-center gap-1 ml-4">
              <Link href="/app" className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
                📺 Ana Sayfa
              </Link>
              <Link href="/app/channels" className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
                📡 Kanallar
              </Link>
              <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400">
                📊 Reyting
              </span>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 mt-6">
        {/* Page title */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-1">
            <span className="bg-gradient-to-r from-red-500 to-emerald-400 bg-clip-text text-transparent">Reyting Tablosu</span> 📊
          </h2>
          <p className="text-sm text-gray-500">YouTube ve ZapTube istatistikleri — kim en çok izleniyor?</p>
        </div>

        {/* Filters & Sort */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Team filter */}
          <div className="flex flex-wrap gap-1.5">
            {data.teams.map((team) => {
              const active = selectedTeam === team.id;
              return (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeam(active ? null : team.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    active
                      ? 'bg-emerald-500/15 ring-1 ring-emerald-500/50 text-emerald-300'
                      : 'bg-[#1e293b] text-gray-400 hover:bg-[#334155] hover:text-white'
                  }`}
                >
                  <span>{team.emoji}</span>
                  <span className="hidden sm:inline">{team.name}</span>
                </button>
              );
            })}
          </div>
          {/* Sort */}
          <div className="flex gap-1.5 sm:ml-auto">
            {([
              { key: 'subscribers' as SortKey, label: 'Abone', emoji: '👥' },
              { key: 'views' as SortKey, label: 'İzlenme', emoji: '👁️' },
              { key: 'videos' as SortKey, label: 'Video', emoji: '🎬' },
              { key: 'engagement' as SortKey, label: 'Etkileşim', emoji: '🔥' },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortKey(opt.key)}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  sortKey === opt.key
                    ? 'bg-yellow-500/15 ring-1 ring-yellow-500/40 text-yellow-400'
                    : 'bg-[#1e293b] text-gray-400 hover:bg-[#334155]'
                }`}
              >
                <span>{opt.emoji}</span>
                <span className="hidden sm:inline">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Stats Table */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-[#1e293b] rounded-xl p-5 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-700" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-700 rounded w-1/3" />
                    <div className="h-3 bg-gray-700 rounded w-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {sortedStats.map((s, idx) => {
              const ch = data.channels.find((c) => c.youtubeChannelId === s.channelId);
              const rank = idx + 1;
              const eng = calcEngagement(s);
              const zap = getZapStats(s.channelId);

              return (
                <div
                  key={s.channelId}
                  className={`bg-[#1e293b] rounded-xl p-4 border transition-all hover:scale-[1.005] ${
                    rank <= 3 ? 'border-yellow-500/20 shadow-md' : 'border-white/5'
                  }`}
                >
                  <div className="flex gap-4">
                    {/* Rank + Avatar */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className={`w-8 text-center font-black ${rank <= 3 ? 'text-lg' : 'text-sm text-gray-500'}`}>
                        {getRankBadge(rank)}
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-lg font-bold overflow-hidden">
                        {s.thumbnail ? (
                          <img src={s.thumbnail} alt={s.title} className="w-full h-full object-cover" />
                        ) : (
                          s.title[0]
                        )}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-bold text-white truncate">{s.title}</h3>
                        {ch?.teams.map((t) => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500 shrink-0">
                            {data.teams.find((team) => team.id === t)?.emoji}
                          </span>
                        ))}
                      </div>

                      {/* YouTube Stats */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-gray-500">👥 Abone</span>
                            <span className="text-xs font-bold text-white">{formatViewCount(s.subscriberCount)}</span>
                          </div>
                          <BarChart value={parseInt(s.subscriberCount)} max={maxSubs} color="#10b981" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-gray-500">👁️ Toplam İzlenme</span>
                            <span className="text-xs font-bold text-white">{formatViewCount(s.viewCount)}</span>
                          </div>
                          <BarChart value={parseInt(s.viewCount)} max={maxViews} color="#3b82f6" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-gray-500">🎬 Video Sayısı</span>
                            <span className="text-xs font-bold text-white">{formatNumber(s.videoCount)}</span>
                          </div>
                          <BarChart value={parseInt(s.videoCount)} max={maxVideos} color="#8b5cf6" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-gray-500">🔥 Etkileşim</span>
                            <span className="text-xs font-bold text-yellow-400">{eng.toFixed(1)}%</span>
                          </div>
                          <BarChart value={eng} max={maxEng} color="#eab308" />
                        </div>
                      </div>

                      {/* ZapTube Stats */}
                      <div className="mt-3 pt-3 border-t border-white/5">
                        <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5 font-bold">
                          <span className="bg-gradient-to-r from-red-500 to-emerald-400 bg-clip-text text-transparent">ZapTube</span> İstatistikleri
                        </p>
                        <div className="flex gap-4">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-500">📺</span>
                            <span className="text-[11px] text-gray-300">{zap.zapViews.toLocaleString('tr-TR')} izlenme</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-500">👥</span>
                            <span className="text-[11px] text-gray-300">{zap.zapFollowers} takipçi</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-500">★</span>
                            <span className="text-[11px] text-gray-300">{zap.zapFavorites} favori</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-500">🔥</span>
                            <span className="text-[11px] text-emerald-400 font-bold">{zap.zapEngagement}% etkileşim</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Summary Cards */}
        {!loading && sortedStats.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 mb-12">
            <div className="bg-gradient-to-br from-emerald-950/40 to-[#1e293b] rounded-xl p-4 border border-emerald-500/20 text-center">
              <p className="text-2xl font-black text-emerald-400">{sortedStats.length}</p>
              <p className="text-[11px] text-gray-400 mt-1">Toplam Kanal</p>
            </div>
            <div className="bg-gradient-to-br from-blue-950/40 to-[#1e293b] rounded-xl p-4 border border-blue-500/20 text-center">
              <p className="text-2xl font-black text-blue-400">
                {formatViewCount(String(sortedStats.reduce((sum, s) => sum + parseInt(s.subscriberCount || '0'), 0)))}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">Toplam Abone</p>
            </div>
            <div className="bg-gradient-to-br from-purple-950/40 to-[#1e293b] rounded-xl p-4 border border-purple-500/20 text-center">
              <p className="text-2xl font-black text-purple-400">
                {formatViewCount(String(sortedStats.reduce((sum, s) => sum + parseInt(s.viewCount || '0'), 0)))}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">Toplam İzlenme</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-950/40 to-[#1e293b] rounded-xl p-4 border border-yellow-500/20 text-center">
              <p className="text-2xl font-black text-yellow-400">
                {sortedStats.reduce((sum, s) => sum + parseInt(s.videoCount || '0'), 0).toLocaleString('tr-TR')}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">Toplam Video</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
