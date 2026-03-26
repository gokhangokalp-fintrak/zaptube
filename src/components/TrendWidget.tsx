'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import channelData from '@/data/channels.json';
import { formatViewCount } from '@/lib/youtube';
import type { ChannelData, Video } from '@/types';

const data = channelData as ChannelData;

interface TrendChannel {
  id: string;
  name: string;
  thumbnail: string;
  subscriberCount: number;
  recentViewTotal: number;
  latestVideo?: Video;
}

export default function TrendWidget() {
  const [trendChannels, setTrendChannels] = useState<TrendChannel[]>([]);
  const [trendVideos, setTrendVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'channels' | 'videos'>('videos');

  useEffect(() => {
    const fetchTrend = async () => {
      try {
        const allIds = data.channels.map(ch => ch.youtubeChannelId);

        // Fetch stats + videos in parallel
        const [statsRes, videosRes] = await Promise.all([
          fetch(`/api/channel-stats?channelIds=${allIds.join(',')}`),
          fetch(`/api/videos?channelIds=${allIds.join(',')}&max=2`),
        ]);

        let stats: any[] = [];
        let videos: Video[] = [];

        if (statsRes.ok) {
          const d = await statsRes.json();
          stats = d.stats || [];
        }
        if (videosRes.ok) {
          const d = await videosRes.json();
          videos = d.videos || [];
        }

        // Top trending videos by views
        const sorted = [...videos]
          .sort((a, b) => parseInt(b.viewCount || '0') - parseInt(a.viewCount || '0'))
          .slice(0, 5);
        setTrendVideos(sorted);

        // Top channels by recent video views
        const merged: TrendChannel[] = data.channels.map(ch => {
          const stat = stats.find(s => s.channelId === ch.youtubeChannelId);
          const chVideos = videos.filter(v => v.channelId === ch.youtubeChannelId);
          const recentViewTotal = chVideos.reduce((sum, v) => sum + parseInt(v.viewCount || '0'), 0);
          const latestVideo = chVideos.sort((a, b) =>
            new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
          )[0];

          return {
            id: ch.id,
            name: ch.name,
            thumbnail: stat?.thumbnail || ch.thumbnail,
            subscriberCount: parseInt(stat?.subscriberCount || '0'),
            recentViewTotal,
            latestVideo,
          };
        })
          .sort((a, b) => b.recentViewTotal - a.recentViewTotal)
          .slice(0, 5);

        setTrendChannels(merged);
      } catch (err) {
        console.error('TrendWidget error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTrend();
  }, []);

  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString('tr-TR');
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}dk`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}sa`;
    const days = Math.floor(hours / 24);
    return `${days}g`;
  };

  if (loading) {
    return (
      <div className="bg-[#1a1a2e] rounded-xl border border-white/10 p-4">
        <div className="animate-pulse text-center text-gray-500 text-xs py-6">
          📊 Trend yükleniyor...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a2e] rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 bg-gradient-to-r from-orange-600/20 to-red-600/20 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
          📊 <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">TREND</span>
        </h3>
        <Link href="/app/trend" className="text-[10px] text-gray-500 hover:text-orange-400 transition-colors">
          Tümünü gör →
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5">
        <button
          onClick={() => setTab('videos')}
          className={`flex-1 py-1.5 text-[10px] font-medium transition-colors ${
            tab === 'videos' ? 'text-orange-400 border-b border-orange-400' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          🔥 Videolar
        </button>
        <button
          onClick={() => setTab('channels')}
          className={`flex-1 py-1.5 text-[10px] font-medium transition-colors ${
            tab === 'channels' ? 'text-orange-400 border-b border-orange-400' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          📡 Kanallar
        </button>
      </div>

      {/* Content */}
      <div className="p-2 space-y-1">
        {tab === 'videos' && trendVideos.map((video, idx) => (
          <a
            key={video.id}
            href={`https://www.youtube.com/watch?v=${video.ytVideoId || video.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-white/5 transition-colors group"
          >
            <span className={`text-[10px] font-bold mt-1 w-4 shrink-0 text-center ${
              idx < 3 ? 'text-orange-400' : 'text-gray-600'
            }`}>
              {idx + 1}
            </span>
            <div className="relative w-16 h-10 rounded overflow-hidden shrink-0">
              <img src={video.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              {video.live && (
                <span className="absolute top-0 left-0 px-1 py-0.5 bg-red-600 text-white text-[7px] font-bold rounded-br">CANLI</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-white group-hover:text-orange-300 transition-colors line-clamp-2 leading-tight">{video.title}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] text-gray-500 truncate">{video.channelTitle}</span>
                <span className="text-[9px] text-gray-600">{formatViewCount(video.viewCount || '0')}</span>
              </div>
            </div>
          </a>
        ))}

        {tab === 'channels' && trendChannels.map((ch, idx) => (
          <div
            key={ch.id}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            <span className={`text-[10px] font-bold w-4 shrink-0 text-center ${
              idx < 3 ? 'text-orange-400' : 'text-gray-600'
            }`}>
              {idx + 1}
            </span>
            <img
              src={ch.thumbnail}
              alt={ch.name}
              className="w-7 h-7 rounded-full object-cover shrink-0 border border-white/10"
              onError={(e) => { (e.target as HTMLImageElement).src = '/images/channels/default.jpg'; }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-white truncate">{ch.name}</p>
              <div className="flex items-center gap-2 text-[9px] text-gray-500">
                <span>{formatNumber(ch.subscriberCount)} abone</span>
                <span className="text-orange-400">{formatNumber(ch.recentViewTotal)} izlenme</span>
              </div>
            </div>
            {idx === 0 && <span className="text-sm">🥇</span>}
            {idx === 1 && <span className="text-sm">🥈</span>}
            {idx === 2 && <span className="text-sm">🥉</span>}
          </div>
        ))}

        {trendVideos.length === 0 && tab === 'videos' && (
          <p className="text-[10px] text-gray-600 text-center py-3">Veri yükleniyor...</p>
        )}
      </div>

      {/* Footer link */}
      <Link
        href="/app/trend"
        className="block px-3 py-2 text-center text-[10px] text-gray-500 hover:text-orange-400 border-t border-white/5 transition-colors"
      >
        📊 Tüm trend verileri →
      </Link>
    </div>
  );
}
