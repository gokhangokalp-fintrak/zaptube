'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import channelData from '@/data/channels.json';
import { Video, ChannelData } from '@/types';
import { getMultiChannelVideos, formatViewCount, formatDate } from '@/lib/youtube';
import { getMockVideosForChannels } from '@/lib/mock-data';
import { createClient } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

const data = channelData as ChannelData;

// =============================================
// ZAP BAR — TV-style channel switching
// =============================================
function ZapBar({
  videos,
  currentIndex,
  onZap,
  onAutoZapToggle,
  autoZapActive,
}: {
  videos: Video[];
  currentIndex: number;
  onZap: (direction: 'prev' | 'next') => void;
  onAutoZapToggle: () => void;
  autoZapActive: boolean;
}) {
  if (videos.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10" style={{ background: 'rgba(17,24,39,0.97)', backdropFilter: 'blur(12px)' }}>
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between">
        {/* Left: Prev button */}
        <button
          onClick={() => onZap('prev')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all active:scale-95 text-gray-300 hover:text-white"
        >
          <span className="text-lg">◀</span>
          <span className="text-xs hidden sm:block">Önceki</span>
        </button>

        {/* Center: Zap info + Auto Zap */}
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="flex items-center gap-2">
              <span className="text-yellow-400 text-lg">⚡</span>
              <span className="text-sm font-bold text-white">ZAP</span>
              <span className="text-yellow-400 text-lg">⚡</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {currentIndex + 1} / {videos.length} kanal
            </p>
          </div>
          <button
            onClick={onAutoZapToggle}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              autoZapActive
                ? 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/40'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            <span className={autoZapActive ? 'animate-spin-slow' : ''}>🔄</span>
            Auto Zap
          </button>
        </div>

        {/* Right: Next button */}
        <button
          onClick={() => onZap('next')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all active:scale-95 text-gray-300 hover:text-white"
        >
          <span className="text-xs hidden sm:block">Sonraki</span>
          <span className="text-lg">▶</span>
        </button>
      </div>
      {/* Auto Zap progress bar */}
      {autoZapActive && (
        <div className="h-0.5 bg-yellow-500/30">
          <div className="h-full bg-yellow-400 auto-zap-progress" />
        </div>
      )}
    </div>
  );
}

// =============================================
// MULTI-VIEW — Side by side viewing
// =============================================
function MultiViewPlayer({
  videos,
  activeAudioIndex,
  onAudioSwitch,
  onClose,
  onRemoveVideo,
}: {
  videos: Video[];
  activeAudioIndex: number;
  onAudioSwitch: (idx: number) => void;
  onClose: () => void;
  onRemoveVideo: (idx: number) => void;
}) {
  if (videos.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] animate-fade-in" style={{ background: 'rgba(0,0,0,0.95)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10" style={{ background: 'rgba(17,24,39,0.9)' }}>
        <div className="flex items-center gap-3">
          <span className="text-lg">📺</span>
          <h2 className="text-sm font-bold text-white">Çoklu İzleme</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
            {videos.length} kanal
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">🔊 Ses: {videos[activeAudioIndex]?.channelTitle}</span>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-lg transition-colors">
            ✕
          </button>
        </div>
      </div>

      {/* Video Grid */}
      <div className={`grid h-[calc(100vh-56px)] ${videos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-1 p-1`}>
        {videos.map((video, idx) => {
          const videoId = video.ytVideoId || extractVideoId(video.url);
          const isAudioActive = idx === activeAudioIndex;

          return (
            <div key={video.id} className="relative group">
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&mute=${isAudioActive ? 0 : 1}`}
                title={video.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
              {/* Overlay controls */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">{video.channelTitle}</p>
                    <p className="text-[10px] text-gray-400 truncate">{video.title}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <button
                      onClick={() => onAudioSwitch(idx)}
                      className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                        isAudioActive
                          ? 'bg-emerald-500/30 text-emerald-400'
                          : 'bg-white/10 text-gray-400 hover:bg-white/20'
                      }`}
                    >
                      {isAudioActive ? '🔊 Aktif' : '🔇 Sesi Aç'}
                    </button>
                    <button
                      onClick={() => onRemoveVideo(idx)}
                      className="px-2 py-1 rounded text-[10px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
              {/* Audio indicator */}
              {isAudioActive && (
                <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                  🔊 SES
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================
// SINGLE PLAYER MODAL — Embedded YouTube iframe
// =============================================
function PlayerModal({
  video,
  onClose,
  allVideos,
  onZap,
}: {
  video: Video | null;
  onClose: () => void;
  allVideos: Video[];
  onZap: (direction: 'prev' | 'next') => void;
}) {
  if (!video) return null;

  const videoId = video.ytVideoId || extractVideoId(video.url);
  const currentIdx = allVideos.findIndex((v) => v.id === video.id);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') onZap('prev');
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') onZap('next');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onZap]);

  return (
    <div className="fixed inset-0 z-[100] animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />
      <div className="relative z-10 flex flex-col h-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3" style={{ background: 'rgba(17,24,39,0.8)' }}>
          <div className="flex items-center gap-3 min-w-0">
            {video.live && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-600 text-white text-xs font-bold shrink-0">
                <span className="w-2 h-2 rounded-full bg-white live-pulse"></span> CANLI
              </span>
            )}
            <h3 className="text-sm font-medium truncate text-white">{video.title}</h3>
          </div>
          <div className="flex items-center gap-2">
            {/* Zap controls in player */}
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
              <button onClick={() => onZap('prev')} className="px-2 py-1 rounded text-xs text-gray-400 hover:bg-white/10 hover:text-white transition-colors" title="Önceki kanal (↑)">
                ◀
              </button>
              <span className="text-[10px] text-gray-500 px-1">{currentIdx + 1}/{allVideos.length}</span>
              <button onClick={() => onZap('next')} className="px-2 py-1 rounded text-xs text-gray-400 hover:bg-white/10 hover:text-white transition-colors" title="Sonraki kanal (↓)">
                ▶
              </button>
            </div>
            <button onClick={onClose} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white text-lg">
              ✕
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-2 pb-2">
          <div className="w-full max-w-5xl aspect-video rounded-xl overflow-hidden bg-black shadow-2xl">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
              title={video.title}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(17,24,39,0.8)' }}>
          <div className="text-sm text-gray-400">
            <span className="text-white font-medium">{video.channelTitle}</span>
            <span className="mx-2">&middot;</span>
            <span>{video.live ? `${formatViewCount(video.viewCount)} izliyor` : `${formatViewCount(video.viewCount)} izlenme`}</span>
            {!video.live && (<><span className="mx-2">&middot;</span><span>{formatDate(video.publishedAt)}</span></>)}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-600">⌨ ← → ile ZAP yap</span>
            <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 rounded-full bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors">
              YouTube&apos;da Aç ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================
// SPONSOR SIDEBAR — Smart ad placement
// =============================================
function SponsorSidebar() {
  return (
    <div className="space-y-4">
      {/* Live Odds Card */}
      <div className="bg-gradient-to-br from-[#1a2332] to-[#1e293b] rounded-xl border border-yellow-500/20 overflow-hidden">
        <div className="px-3 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-yellow-400">CANLI BAHİS</span>
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 live-pulse"></span>
          </div>
          <p className="text-[10px] text-gray-500 mt-0.5">Sponsor alanı</p>
        </div>
        <div className="p-3">
          <p className="text-xs text-gray-400 mb-2">Galatasaray vs Fenerbahçe</p>
          <div className="grid grid-cols-3 gap-1.5">
            <div className="bg-white/5 rounded-lg p-2 text-center hover:bg-white/10 transition-colors cursor-pointer">
              <p className="text-[10px] text-gray-500">1</p>
              <p className="text-sm font-bold text-white">2.10</p>
            </div>
            <div className="bg-white/5 rounded-lg p-2 text-center hover:bg-white/10 transition-colors cursor-pointer">
              <p className="text-[10px] text-gray-500">X</p>
              <p className="text-sm font-bold text-white">3.20</p>
            </div>
            <div className="bg-white/5 rounded-lg p-2 text-center hover:bg-white/10 transition-colors cursor-pointer">
              <p className="text-[10px] text-gray-500">2</p>
              <p className="text-sm font-bold text-white">2.80</p>
            </div>
          </div>
          <button className="w-full mt-2 py-2 rounded-lg bg-yellow-500/20 text-yellow-400 text-xs font-bold hover:bg-yellow-500/30 transition-colors">
            HEMEN OYNA →
          </button>
        </div>
      </div>

      {/* Featured Channels */}
      <div className="bg-[#1e293b] rounded-xl p-3 border border-white/5">
        <h4 className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2">
          ⭐ Öne Çıkan Kanallar
        </h4>
        <div className="space-y-2">
          {data.channels.slice(0, 3).map((ch) => (
            <button key={ch.id} className="flex items-center gap-2 w-full p-1.5 rounded-lg hover:bg-white/5 transition-colors text-left">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-xs font-bold shrink-0">
                {ch.name[0]}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate">{ch.name}</p>
                <p className="text-[10px] text-gray-500 truncate">{ch.description.substring(0, 40)}...</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Ad Banner Placeholder */}
      <div className="bg-gradient-to-br from-[#1a2332] to-[#1e293b] rounded-xl border border-white/5 p-4 text-center">
        <p className="text-[10px] text-gray-600 uppercase tracking-wider">Reklam Alanı</p>
        <p className="text-[10px] text-gray-700 mt-1">Sponsor olarak burada yer alın</p>
        <p className="text-[10px] text-emerald-500/50 mt-2">ads@zaptube.com</p>
      </div>
    </div>
  );
}

// =============================================
// LIVE BANNER
// =============================================
function LiveBanner({ liveVideos, onSelect, onMultiView }: { liveVideos: Video[]; onSelect: (v: Video) => void; onMultiView: (videos: Video[]) => void }) {
  if (liveVideos.length === 0) return null;
  return (
    <section className="mb-6 animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-500 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 live-pulse"></span>
          <span className="text-red-400 font-semibold">Şu An Canlı</span>
          <span className="text-gray-600 text-xs">({liveVideos.length} yayın)</span>
        </h3>
        {liveVideos.length >= 2 && (
          <button
            onClick={() => onMultiView(liveVideos.slice(0, 2))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
          >
            📺 Çoklu İzle ({Math.min(liveVideos.length, 2)})
          </button>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollSnapType: 'x mandatory' }}>
        {liveVideos.map((video) => (
          <button key={video.id} onClick={() => onSelect(video)}
            className="flex-shrink-0 w-72 bg-gradient-to-br from-red-950/40 to-[#1e293b] hover:from-red-950/60 border border-red-500/20 hover:border-red-500/40 rounded-xl overflow-hidden transition-all hover:scale-[1.02] group text-left"
            style={{ scrollSnapAlign: 'start' }}>
            <div className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900">
              {video.thumbnail && (
                <img src={video.thumbnail} alt={video.title} className="absolute inset-0 w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-red-600/80 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                </div>
              </div>
              <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-white live-pulse"></span> CANLI
              </div>
              <div className="absolute bottom-2 right-2 text-[10px] text-white/70 bg-black/60 px-1.5 py-0.5 rounded">
                {formatViewCount(video.viewCount)} izliyor
              </div>
            </div>
            <div className="p-3">
              <p className="text-sm font-medium line-clamp-2 group-hover:text-red-400 transition-colors leading-snug">{video.title}</p>
              <p className="text-[11px] text-gray-500 mt-1">{video.channelTitle}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

// =============================================
// PROFILE MENU
// =============================================
function ProfileMenu({ user }: { user: User | null }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  if (!user) return null;

  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Kullanıcı';
  const avatar = user.user_metadata?.avatar_url;

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-full hover:bg-white/5 p-1 pr-3 transition-colors">
        {avatar ? (
          <img src={avatar} alt={name} className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
            {name[0]?.toUpperCase()}
          </div>
        )}
        <span className="text-xs text-gray-400 hidden sm:block">{name}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-[#1e293b] border border-white/10 rounded-xl shadow-xl py-1 min-w-[160px]">
            <div className="px-3 py-2 border-b border-white/5">
              <p className="text-xs font-medium text-white">{name}</p>
              <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
            </div>
            <button onClick={handleLogout}
              className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-white/5 transition-colors">
              Çıkış Yap
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// =============================================
// HELPER
// =============================================
function extractVideoId(url: string): string {
  const match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : '';
}

// =============================================
// MAIN APP (Protected — /app)
// =============================================
export default function AppPage() {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedContentType, setSelectedContentType] = useState<string | null>(null);
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  // Multi-view state
  const [multiViewVideos, setMultiViewVideos] = useState<Video[]>([]);
  const [multiViewAudioIndex, setMultiViewAudioIndex] = useState(0);

  // Auto Zap state
  const [autoZapActive, setAutoZapActive] = useState(false);
  const autoZapRef = useRef<NodeJS.Timeout | null>(null);

  // Get current user
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  // Filter channels based on selections
  const filteredChannels = useMemo(() => {
    return data.channels.filter((ch) => {
      const teamMatch = !selectedTeam || selectedTeam === 'genel' || ch.teams.includes(selectedTeam) || ch.teams.includes('genel');
      const contentMatch = !selectedContentType || ch.contentTypes.includes(selectedContentType);
      return teamMatch && contentMatch;
    });
  }, [selectedTeam, selectedContentType]);

  // Fetch real videos from YouTube API (with cache + fallback to mock)
  useEffect(() => {
    if (filteredChannels.length === 0) {
      setVideos([]);
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
    const channelYtIds = filteredChannels.map((ch) => ch.youtubeChannelId);

    const hasRealIds = channelYtIds.every((id) => id.startsWith('UC'));
    if (!apiKey || !hasRealIds) {
      const channelIds = filteredChannels.map((ch) => ch.id);
      setVideos(getMockVideosForChannels(channelIds));
      return;
    }

    setLoading(true);
    getMultiChannelVideos(channelYtIds, apiKey, 3)
      .then((result) => {
        if (result.length > 0) {
          setVideos(result);
        } else {
          const channelIds = filteredChannels.map((ch) => ch.id);
          setVideos(getMockVideosForChannels(channelIds));
        }
      })
      .catch(() => {
        const channelIds = filteredChannels.map((ch) => ch.id);
        setVideos(getMockVideosForChannels(channelIds));
      })
      .finally(() => setLoading(false));
  }, [filteredChannels]);

  // Separate live and regular videos
  const liveVideos = useMemo(() => videos.filter((v) => v.live), [videos]);
  const regularVideos = useMemo(
    () => videos.filter((v) => !v.live).sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()),
    [videos]
  );

  // All videos for zap navigation
  const allVideos = useMemo(() => [...liveVideos, ...regularVideos], [liveVideos, regularVideos]);

  // ZAP function — switch between videos
  const handleZap = useCallback(
    (direction: 'prev' | 'next') => {
      if (allVideos.length === 0) return;

      if (!activeVideo) {
        setActiveVideo(allVideos[0]);
        return;
      }

      const currentIdx = allVideos.findIndex((v) => v.id === activeVideo.id);
      let newIdx: number;

      if (direction === 'next') {
        newIdx = (currentIdx + 1) % allVideos.length;
      } else {
        newIdx = (currentIdx - 1 + allVideos.length) % allVideos.length;
      }

      setActiveVideo(allVideos[newIdx]);
    },
    [activeVideo, allVideos]
  );

  // Auto Zap — automatically switch channels
  useEffect(() => {
    if (autoZapActive && activeVideo) {
      autoZapRef.current = setInterval(() => {
        handleZap('next');
      }, 15000); // 15 seconds per channel

      return () => {
        if (autoZapRef.current) clearInterval(autoZapRef.current);
      };
    } else {
      if (autoZapRef.current) clearInterval(autoZapRef.current);
    }
  }, [autoZapActive, activeVideo, handleZap]);

  // Keyboard ZAP (global — when not in modal)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (activeVideo || multiViewVideos.length > 0) return; // Modal handles its own keys
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        handleZap('prev');
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        handleZap('next');
      }
      // Spacebar to start zapping
      if (e.key === ' ' && !activeVideo) {
        e.preventDefault();
        if (allVideos.length > 0) setActiveVideo(allVideos[0]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeVideo, multiViewVideos, handleZap, allVideos]);

  // Multi-view handlers
  const handleStartMultiView = useCallback((vids: Video[]) => {
    setMultiViewVideos(vids.slice(0, 4)); // Max 4
    setMultiViewAudioIndex(0);
    setActiveVideo(null);
  }, []);

  const handleMultiViewAdd = useCallback(
    (video: Video) => {
      if (multiViewVideos.length >= 4) return;
      if (multiViewVideos.find((v) => v.id === video.id)) return;
      setMultiViewVideos((prev) => [...prev, video]);
    },
    [multiViewVideos]
  );

  const handleReset = useCallback(() => {
    setSelectedTeam(null);
    setSelectedContentType(null);
  }, []);

  const currentZapIndex = activeVideo ? allVideos.findIndex((v) => v.id === activeVideo.id) : 0;

  return (
    <main className="min-h-screen pb-20">
      {/* Single Player Modal with Zap */}
      <PlayerModal
        video={activeVideo}
        onClose={() => {
          setActiveVideo(null);
          setAutoZapActive(false);
        }}
        allVideos={allVideos}
        onZap={handleZap}
      />

      {/* Multi-View Player */}
      <MultiViewPlayer
        videos={multiViewVideos}
        activeAudioIndex={multiViewAudioIndex}
        onAudioSwitch={setMultiViewAudioIndex}
        onClose={() => setMultiViewVideos([])}
        onRemoveVideo={(idx) => {
          setMultiViewVideos((prev) => prev.filter((_, i) => i !== idx));
          if (multiViewAudioIndex >= idx && multiViewAudioIndex > 0) {
            setMultiViewAudioIndex((prev) => prev - 1);
          }
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5" style={{ background: 'rgba(17,24,39,0.95)', backdropFilter: 'blur(8px)' }}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📺</span>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                <span className="bg-gradient-to-r from-red-500 to-emerald-400 bg-clip-text text-transparent">Zap</span>Tube
              </h1>
              <p className="text-xs text-gray-500 hidden sm:block">YouTube futbol kumandan</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {liveVideos.length > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-500 live-pulse"></span>
                {liveVideos.length} Canlı
              </span>
            )}
            {(selectedTeam || selectedContentType) && (
              <button onClick={handleReset} className="text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-gray-400">
                Sıfırla
              </button>
            )}
            <ProfileMenu user={user} />
          </div>
        </div>
      </header>

      {/* MAIN CONTENT WITH SIDEBAR */}
      <div className="max-w-7xl mx-auto px-4 mt-6 flex gap-6">
        {/* Left: Main Content */}
        <div className="flex-1 min-w-0">
          {/* Hero */}
          {!selectedTeam && !selectedContentType && (
            <div className="text-center mb-8 animate-slide-up">
              <h2 className="text-3xl sm:text-4xl font-bold mb-2">
                <span className="bg-gradient-to-r from-red-500 to-emerald-400 bg-clip-text text-transparent">Zap Yap!</span> ⚡
              </h2>
              <p className="text-gray-400 text-sm sm:text-base max-w-md mx-auto">
                Takımını seç, ne izlemek istediğini belirle — seni doğru kanala zaplarız.
              </p>
              <p className="text-gray-600 text-xs mt-2">⌨ Space ile hemen başla · ← → ile ZAP yap</p>
            </div>
          )}

          {/* Step 1: Team Selection */}
          <section className="mb-6">
            <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center font-bold">1</span>
              Takımını Seç
            </h3>
            <div className="flex flex-wrap gap-2 stagger">
              {data.teams.map((team) => {
                const active = selectedTeam === team.id;
                return (
                  <button key={team.id} onClick={() => setSelectedTeam(active ? null : team.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${active ? 'scale-105 shadow-lg' : 'bg-[#1e293b] hover:bg-[#334155] text-gray-300 hover:text-white'}`}
                    style={active ? { backgroundColor: team.color + '22', color: team.color === '#000000' ? '#fff' : team.color, boxShadow: `0 0 20px ${team.color}33, inset 0 0 0 1px ${team.color}55` } : undefined}>
                    <span className="text-lg">{team.emoji}</span>
                    <span>{team.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Step 2: Content Type */}
          <section className="mb-8">
            <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center font-bold">2</span>
              Ne İzlemek İstiyorsun?
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 stagger">
              {data.contentTypes.map((ct) => {
                const active = selectedContentType === ct.id;
                return (
                  <button key={ct.id} onClick={() => setSelectedContentType(active ? null : ct.id)}
                    className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-sm transition-all duration-200 ${active ? 'bg-emerald-500/15 ring-1 ring-emerald-500/50 text-emerald-300 scale-105' : 'bg-[#1e293b] hover:bg-[#334155] text-gray-400 hover:text-white'}`}>
                    <span className="text-xl">{ct.emoji}</span>
                    <span className="font-medium text-xs">{ct.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Active Filters */}
          {(selectedTeam || selectedContentType) && (
            <div className="flex flex-wrap items-center gap-2 mb-4 text-sm text-gray-400 animate-slide-up">
              <span>🔍</span>
              {selectedTeam && (
                <span className="px-2 py-0.5 rounded-md bg-white/5">
                  {data.teams.find((t) => t.id === selectedTeam)?.emoji} {data.teams.find((t) => t.id === selectedTeam)?.name}
                </span>
              )}
              {selectedContentType && (
                <span className="px-2 py-0.5 rounded-md bg-white/5">
                  {data.contentTypes.find((ct) => ct.id === selectedContentType)?.emoji} {data.contentTypes.find((ct) => ct.id === selectedContentType)?.name}
                </span>
              )}
              <span className="text-gray-600">— {filteredChannels.length} kanal, {videos.length} video</span>
            </div>
          )}

          {/* LIVE SECTION */}
          <LiveBanner liveVideos={liveVideos} onSelect={setActiveVideo} onMultiView={handleStartMultiView} />

          {/* Matching Channels */}
          {filteredChannels.length > 0 && (selectedTeam || selectedContentType) && (
            <section className="mb-6 animate-slide-up">
              <h3 className="text-sm font-medium text-gray-500 mb-3">📡 Eşleşen Kanallar</h3>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollSnapType: 'x mandatory' }}>
                {filteredChannels.map((ch) => (
                  <a key={ch.id} href={`https://www.youtube.com/channel/${ch.youtubeChannelId}`} target="_blank" rel="noopener noreferrer"
                    className="flex-shrink-0 bg-[#1e293b] hover:bg-[#334155] rounded-xl p-3 w-48 transition-all hover:scale-[1.02] group" style={{ scrollSnapAlign: 'start' }}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-lg font-bold shrink-0">{ch.name[0]}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-emerald-400 transition-colors">{ch.name}</p>
                        <div className="flex gap-1 mt-0.5">
                          {ch.teams.map((t) => (
                            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">{data.teams.find((team) => team.id === t)?.emoji}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500 line-clamp-2">{ch.description}</p>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Videos Grid */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
              🎬 {selectedTeam || selectedContentType ? 'Önerilen Videolar' : 'Son Videolar'}
            </h3>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="bg-[#1e293b] rounded-xl overflow-hidden animate-pulse">
                    <div className="aspect-video bg-gray-800" />
                    <div className="p-3 space-y-2">
                      <div className="h-4 bg-gray-800 rounded w-3/4" />
                      <div className="h-3 bg-gray-800 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : regularVideos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
                {regularVideos.map((video) => (
                  <div key={video.id} className="group bg-[#1e293b] hover:bg-[#334155] rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/20">
                    <button onClick={() => setActiveVideo(video)} className="text-left w-full">
                      <div className="relative aspect-video bg-gray-800">
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
                        {video.thumbnail ? (
                          <img src={video.thumbnail} alt={video.title} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
                            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 group-hover:scale-110 transition-all">
                              <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                            </div>
                          </div>
                        )}
                        {video.duration && (
                          <span className="absolute bottom-2 right-2 z-20 text-[10px] font-medium bg-black/80 px-1.5 py-0.5 rounded">{video.duration}</span>
                        )}
                      </div>
                      <div className="p-3">
                        <h4 className="text-sm font-medium line-clamp-2 group-hover:text-emerald-400 transition-colors leading-snug mb-2">{video.title}</h4>
                        <div className="flex items-center justify-between text-[11px] text-gray-500">
                          <span className="truncate">{video.channelTitle}</span>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            {video.viewCount && <span>{formatViewCount(video.viewCount)} izlenme</span>}
                            <span>{formatDate(video.publishedAt)}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                    {/* Multi-view add button */}
                    <div className="px-3 pb-2 flex justify-end">
                      <button
                        onClick={() => handleMultiViewAdd(video)}
                        className="text-[10px] px-2 py-1 rounded bg-white/5 text-gray-500 hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors"
                        title="Çoklu izlemeye ekle"
                      >
                        + Çoklu İzle
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-gray-600">
                <span className="text-4xl block mb-3">📺</span>
                <p className="text-sm">Bu filtrelere uygun video bulunamadı.</p>
                <p className="text-xs mt-1">Farklı bir takım veya içerik tipi deneyin.</p>
              </div>
            )}
          </section>
        </div>

        {/* Right: Sponsor Sidebar (hidden on mobile) */}
        <div className="hidden lg:block w-72 shrink-0">
          <div className="sticky top-20">
            <SponsorSidebar />
          </div>
        </div>
      </div>

      {/* ZAP BAR — Fixed bottom */}
      <ZapBar
        videos={allVideos}
        currentIndex={currentZapIndex}
        onZap={handleZap}
        onAutoZapToggle={() => {
          if (!autoZapActive && !activeVideo && allVideos.length > 0) {
            setActiveVideo(allVideos[0]);
          }
          setAutoZapActive(!autoZapActive);
        }}
        autoZapActive={autoZapActive}
      />

      <footer className="mt-16 mb-16 border-t border-white/5 py-6 text-center text-xs text-gray-600">
        <p>ZapTube — YouTube futbol kumandan</p>
        <p className="mt-1">Zap yap, doğru kanala ulaş, keyfine bak ⚽⚡</p>
      </footer>
    </main>
  );
}
