'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import channelData from '@/data/channels.json';
import { formatViewCount } from '@/lib/youtube';
import type { ChannelData, Video } from '@/types';
import AdBanner from '@/components/ads/AdBanner';

const data = channelData as ChannelData;

interface ChannelWithStats {
  id: string;
  name: string;
  youtubeChannelId: string;
  thumbnail: string;
  teams: string[];
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
  recentVideos: Video[];
  recentViewTotal: number;
  latestUpload: string; // ISO date
}

type Tab = 'hot' | 'recent' | 'mostViewed' | 'rising';

export default function TrendPage() {
  const [channels, setChannels] = useState<ChannelWithStats[]>([]);
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('hot');
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        // Fetch channel stats
        const allIds = data.channels.map(ch => ch.youtubeChannelId);
        const batchSize = 50;
        let allStats: any[] = [];

        for (let i = 0; i < allIds.length; i += batchSize) {
          const batch = allIds.slice(i, i + batchSize).join(',');
          const res = await fetch(`/api/channel-stats?channelIds=${batch}`);
          if (res.ok) {
            const d = await res.json();
            allStats = [...allStats, ...(d.stats || [])];
          }
        }

        // Fetch recent videos from all channels (max 3 per channel)
        const videoRes = await fetch(`/api/videos?channelIds=${allIds.join(',')}&max=3`);
        let videos: Video[] = [];
        if (videoRes.ok) {
          const vd = await videoRes.json();
          videos = vd.videos || [];
        }
        setAllVideos(videos);

        // Merge channel info + stats + videos
        const merged: ChannelWithStats[] = data.channels.map(ch => {
          const stat = allStats.find(s => s.channelId === ch.youtubeChannelId);
          const chVideos = videos.filter(v => v.channelId === ch.youtubeChannelId);
          const recentViewTotal = chVideos.reduce((sum, v) => sum + parseInt(v.viewCount || '0'), 0);
          const latestUpload = chVideos.length > 0
            ? chVideos.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())[0].publishedAt
            : '';

          return {
            id: ch.id,
            name: ch.name,
            youtubeChannelId: ch.youtubeChannelId,
            thumbnail: stat?.thumbnail || ch.thumbnail,
            teams: ch.teams,
            subscriberCount: parseInt(stat?.subscriberCount || '0'),
            viewCount: parseInt(stat?.viewCount || '0'),
            videoCount: parseInt(stat?.videoCount || '0'),
            recentVideos: chVideos,
            recentViewTotal,
            latestUpload,
          };
        });

        setChannels(merged);
      } catch (err) {
        console.error('Trend fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  // Filter by team
  const filtered = useMemo(() => {
    if (!selectedTeam) return channels;
    return channels.filter(ch => ch.teams.includes(selectedTeam));
  }, [channels, selectedTeam]);

  // Sorted channels by tab
  const sortedChannels = useMemo(() => {
    const arr = [...filtered];
    switch (activeTab) {
      case 'hot':
        // En çok izlenen son videolar
        return arr.sort((a, b) => b.recentViewTotal - a.recentViewTotal);
      case 'recent':
        // En son yükleme yapanlar
        return arr
          .filter(ch => ch.latestUpload)
          .sort((a, b) => new Date(b.latestUpload).getTime() - new Date(a.latestUpload).getTime());
      case 'mostViewed':
        // Toplam izlenme
        return arr.sort((a, b) => b.viewCount - a.viewCount);
      case 'rising':
        // Engagement: recent views / subscriber ratio
        return arr
          .filter(ch => ch.subscriberCount > 0)
          .sort((a, b) => (b.recentViewTotal / b.subscriberCount) - (a.recentViewTotal / a.subscriberCount));
    }
  }, [filtered, activeTab]);

  // Top trending videos (all channels)
  const trendingVideos = useMemo(() => {
    return [...allVideos]
      .sort((a, b) => parseInt(b.viewCount || '0') - parseInt(a.viewCount || '0'))
      .slice(0, 10);
  }, [allVideos]);

  const formatNumber = (n: number) => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString('tr-TR');
  };

  const timeAgo = (dateStr: string) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} dk önce`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} saat önce`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} gün önce`;
    return `${Math.floor(days / 7)} hafta önce`;
  };

  const tabs: { key: Tab; label: string; emoji: string }[] = [
    { key: 'hot', label: 'En Çok İzlenen', emoji: '🔥' },
    { key: 'recent', label: 'Son Yüklenenler', emoji: '🆕' },
    { key: 'mostViewed', label: 'Toplam İzlenme', emoji: '👁' },
    { key: 'rising', label: 'Yükselen', emoji: '📈' },
  ];

  const teams = data.teams || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">📊</div>
          <p className="text-gray-400 text-sm">Trend verileri yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0a0a1a]/95 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Link href="/app" className="text-gray-400 hover:text-white transition-colors text-sm">
                ← Ana Sayfa
              </Link>
              <h1 className="text-lg font-bold flex items-center gap-2">
                📊 <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">Trend</span>
              </h1>
            </div>
            <span className="text-[10px] text-gray-600">Son güncelleme: şimdi</span>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.key
                    ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg shadow-red-500/20'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {tab.emoji} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Team filter */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedTeam(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              !selectedTeam ? 'bg-white/15 text-white' : 'bg-white/5 text-gray-500 hover:bg-white/10'
            }`}
          >
            Tümü
          </button>
          {teams.map(team => (
            <button
              key={team.id}
              onClick={() => setSelectedTeam(selectedTeam === team.id ? null : team.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                selectedTeam === team.id ? 'bg-white/15 text-white' : 'bg-white/5 text-gray-500 hover:bg-white/10'
              }`}
            >
              {team.emoji} {team.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* LEFT: Channel Rankings */}
          <div className="lg:col-span-2 space-y-2">
            <h2 className="text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">
              {tabs.find(t => t.key === activeTab)?.emoji} {tabs.find(t => t.key === activeTab)?.label} Kanallar
              <span className="text-[10px] text-gray-600 font-normal">({sortedChannels.length} kanal)</span>
            </h2>

            {sortedChannels.slice(0, 20).map((ch, idx) => (
              <div
                key={ch.id}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-white/5 ${
                  idx < 3 ? 'bg-gradient-to-r from-yellow-500/5 to-transparent border border-yellow-500/10' : 'bg-white/[0.02]'
                }`}
              >
                {/* Rank */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                  idx === 1 ? 'bg-gray-400/20 text-gray-300' :
                  idx === 2 ? 'bg-orange-500/20 text-orange-400' :
                  'bg-white/5 text-gray-500'
                }`}>
                  {idx + 1}
                </div>

                {/* Thumbnail */}
                <img
                  src={ch.thumbnail}
                  alt={ch.name}
                  className="w-10 h-10 rounded-full object-cover shrink-0 border border-white/10"
                  onError={(e) => { (e.target as HTMLImageElement).src = '/images/channels/default.jpg'; }}
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white truncate">{ch.name}</h3>
                  <div className="flex items-center gap-3 text-[10px] text-gray-500 mt-0.5">
                    <span>{formatNumber(ch.subscriberCount)} abone</span>
                    <span>{formatNumber(ch.videoCount)} video</span>
                    {ch.latestUpload && (
                      <span className="text-green-400">{timeAgo(ch.latestUpload)}</span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="text-right shrink-0">
                  {activeTab === 'hot' && (
                    <div>
                      <div className="text-sm font-bold text-orange-400">{formatNumber(ch.recentViewTotal)}</div>
                      <div className="text-[10px] text-gray-500">son izlenme</div>
                    </div>
                  )}
                  {activeTab === 'recent' && ch.latestUpload && (
                    <div>
                      <div className="text-sm font-bold text-green-400">{timeAgo(ch.latestUpload)}</div>
                      <div className="text-[10px] text-gray-500">son video</div>
                    </div>
                  )}
                  {activeTab === 'mostViewed' && (
                    <div>
                      <div className="text-sm font-bold text-blue-400">{formatNumber(ch.viewCount)}</div>
                      <div className="text-[10px] text-gray-500">toplam izlenme</div>
                    </div>
                  )}
                  {activeTab === 'rising' && (
                    <div>
                      <div className="text-sm font-bold text-purple-400">
                        {ch.subscriberCount > 0 ? `${((ch.recentViewTotal / ch.subscriberCount) * 100).toFixed(1)}%` : '-'}
                      </div>
                      <div className="text-[10px] text-gray-500">etkileşim oranı</div>
                    </div>
                  )}
                </div>

                {/* Trend indicator */}
                {idx < 3 && (
                  <span className="text-lg shrink-0">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                  </span>
                )}
              </div>
            ))}

            {sortedChannels.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-3xl mb-2">📭</div>
                <p className="text-sm">Bu filtreye uygun kanal bulunamadı</p>
              </div>
            )}
          </div>

          {/* RIGHT: Trending Videos + Ad */}
          <div className="space-y-4">
            {/* Ad */}
            <AdBanner slot="sidebar" />

            {/* Trending Videos */}
            <div className="bg-white/[0.03] rounded-xl border border-white/5 p-4">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                🔥 Trend Videolar
              </h3>
              <div className="space-y-3">
                {trendingVideos.map((video, idx) => (
                  <a
                    key={video.id}
                    href={`https://www.youtube.com/watch?v=${video.ytVideoId || video.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 group hover:bg-white/5 rounded-lg p-1.5 -mx-1.5 transition-colors"
                  >
                    <span className={`text-xs font-bold mt-0.5 w-5 shrink-0 text-center ${
                      idx < 3 ? 'text-orange-400' : 'text-gray-600'
                    }`}>
                      {idx + 1}
                    </span>
                    <div className="relative w-20 h-12 rounded overflow-hidden shrink-0">
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      {video.live && (
                        <span className="absolute top-0.5 left-0.5 px-1 py-0.5 bg-red-600 text-white text-[8px] font-bold rounded">CANLI</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white group-hover:text-orange-300 transition-colors line-clamp-2 leading-tight">
                        {video.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-500 truncate">{video.channelTitle}</span>
                        <span className="text-[10px] text-gray-600">{formatViewCount(video.viewCount || '0')}</span>
                      </div>
                    </div>
                  </a>
                ))}
                {trendingVideos.length === 0 && (
                  <p className="text-xs text-gray-600 text-center py-4">Video verisi yükleniyor...</p>
                )}
              </div>
            </div>

            {/* Quick Stats Summary */}
            <div className="bg-white/[0.03] rounded-xl border border-white/5 p-4">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                📈 Özet
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-emerald-400">{channels.length}</div>
                  <div className="text-[10px] text-gray-500">Toplam Kanal</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-blue-400">{allVideos.length}</div>
                  <div className="text-[10px] text-gray-500">Son Videolar</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-orange-400">
                    {formatNumber(channels.reduce((sum, ch) => sum + ch.subscriberCount, 0))}
                  </div>
                  <div className="text-[10px] text-gray-500">Toplam Abone</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-purple-400">
                    {formatNumber(channels.reduce((sum, ch) => sum + ch.recentViewTotal, 0))}
                  </div>
                  <div className="text-[10px] text-gray-500">Son İzlenme</div>
                </div>
              </div>
            </div>

            {/* Ad */}
            <AdBanner slot="sidebar" />
          </div>
        </div>
      </div>
    </div>
  );
}
