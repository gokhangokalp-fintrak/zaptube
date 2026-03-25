'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import channelData from '@/data/channels.json';
import { Video, ChannelData } from '@/types';
import { getMultiChannelVideos, formatViewCount, formatDate } from '@/lib/youtube';
// Mock data removed — only real YouTube API data is used
import { createClient } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import AdBanner from '@/components/ads/AdBanner';
import PrerollAd from '@/components/ads/PrerollAd';
import ChatPanel from '@/components/ChatPanel';

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
// GLOBAL SOHBET — Live chat panel (mockup-style)
// =============================================
const MOCK_CHAT_MESSAGES = [
  { user: 'Emre1905', msg: 'Bu derbi tam bir olaydı! 🔥🔥', likes: 12, avatar: '🦁' },
  { user: 'Fener41', msg: 'Hakem berbattı, rezalet!', likes: 8, avatar: '🐤' },
  { user: 'Arda34', msg: 'Galatasaray şampiyonluk yolunda çok iyi gidiyor 😎', likes: 5, avatar: '🦁' },
  { user: 'Sultan1907', msg: "Fenerbahçe'nin toparlanması lazım.", likes: 4, avatar: '🐤' },
  { user: 'Cenk54', msg: 'Bu maçtan sonra ortalık fena karışır 😅', likes: 6, avatar: '🦅' },
  { user: 'Karadeniz61', msg: 'Trabzon bu sene süper oynuyor', likes: 3, avatar: '⭐' },
  { user: 'Ali_GS', msg: 'Icardi yine attı, efsane! ⚽', likes: 9, avatar: '🦁' },
];

function GlobalSohbet() {
  const [chatInput, setChatInput] = useState('');

  return (
    <div className="flex flex-col h-full bg-[#0f1724] rounded-xl border border-white/10 overflow-hidden">
      {/* Chat Header */}
      <div className="px-3 py-2.5 border-b border-white/10 flex items-center gap-2">
        <span className="text-sm">💬</span>
        <div className="flex gap-1">
          <button className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold">Global Sohbet</button>
          <button className="px-3 py-1 rounded-full bg-white/5 text-gray-500 text-xs hover:bg-white/10 transition-colors">Kanal Sohbeti</button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {MOCK_CHAT_MESSAGES.map((m, i) => (
          <div key={i} className="flex gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-sm shrink-0">
              {m.avatar}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">{m.user}:</span>
                <span className="text-xs text-gray-300">{m.msg}</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] text-gray-500">👍 {m.likes}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Emoji bar + Input */}
      <div className="border-t border-white/10 p-2">
        <div className="flex gap-1 mb-2">
          {['🔥', '😂', '😤', '⚽', '👏'].map((e) => (
            <button key={e} className="w-7 h-7 rounded bg-white/5 hover:bg-white/10 text-sm flex items-center justify-center transition-colors">
              {e}
            </button>
          ))}
          <button className="ml-auto px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 text-[10px] font-bold hover:bg-yellow-500/30 transition-colors">
            Gönder
          </button>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Mesajınızı yazın..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-yellow-500/40"
          />
          <button className="px-2 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-colors">
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================
// SINGLE PLAYER MODAL — Mockup-style layout
// Left: Chat | Center: Player | Right: Betting+Channels
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

  // Featured channels for right sidebar (exclude current)
  const featuredChannels = data.channels.filter((ch) => ch.youtubeChannelId !== video.channelId).slice(0, 3);

  return (
    <div className="fixed inset-0 z-[100] animate-fade-in bg-[#0a0e1a]">
      {/* Top Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-white/10" style={{ background: 'rgba(10,14,26,0.95)' }}>
        <div className="flex items-center gap-3">
          <span className="text-lg">📺</span>
          <h1 className="text-sm font-bold">
            <span className="bg-gradient-to-r from-red-500 to-emerald-400 bg-clip-text text-transparent">Zap</span>
            <span className="text-white">Tube</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-600">⌨ ← → ile ZAP yap · ESC kapat</span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-sm transition-colors">
            ✕
          </button>
        </div>
      </header>

      {/* 3-column layout */}
      <div className="flex h-[calc(100vh-88px)]">
        {/* LEFT: Global Sohbet — hidden on small screens */}
        <div className="hidden lg:flex w-80 shrink-0 p-2">
          <GlobalSohbet />
        </div>

        {/* CENTER: Main Player */}
        <div className="flex-1 flex flex-col min-w-0 p-2">
          {/* Video Title Bar */}
          <div className="bg-[#111827] rounded-t-xl px-4 py-2.5 border border-white/10 border-b-0 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {video.live && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-white live-pulse"></span> CANLI
                </span>
              )}
              <h3 className="text-sm font-semibold truncate text-white">{video.title}</h3>
            </div>
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5 shrink-0 ml-2">
              <button onClick={() => onZap('prev')} className="px-2 py-1 rounded text-xs text-gray-400 hover:bg-white/10 hover:text-white transition-colors">◀</button>
              <span className="text-[10px] text-gray-500 px-1">{currentIdx + 1}/{allVideos.length}</span>
              <button onClick={() => onZap('next')} className="px-2 py-1 rounded text-xs text-gray-400 hover:bg-white/10 hover:text-white transition-colors">▶</button>
            </div>
          </div>

          {/* Player iframe */}
          <div className="flex-1 bg-black rounded-b-xl overflow-hidden border border-white/10 border-t-0 relative">
            <iframe
              key={videoId}
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
              title={video.title}
              className="w-full h-full channel-switch"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          {/* Player bottom ad */}
          <AdBanner slot="player-bottom" className="mt-1" />
        </div>

        {/* RIGHT: Betting + Featured Channels — hidden on small screens */}
        <div className="hidden md:flex flex-col w-64 shrink-0 p-2 gap-2 overflow-y-auto">
          {/* Canlı Bahis Card */}
          <div className="bg-gradient-to-br from-[#1a2332] to-[#1e293b] rounded-xl border border-yellow-500/30 overflow-hidden">
            <div className="px-3 py-2 bg-yellow-500/20 border-b border-yellow-500/30">
              <p className="text-xs font-black text-yellow-400 tracking-wider">CANLI BAHİS Nesine..</p>
            </div>
            <div className="p-3">
              <p className="text-xs text-gray-300 font-medium mb-2 text-center">Galatasaray vs Fenerbahçe</p>
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                <div className="bg-white/5 rounded-lg p-2 text-center hover:bg-white/10 transition-colors cursor-pointer">
                  <p className="text-[10px] text-gray-500">1:</p>
                  <p className="text-sm font-bold text-emerald-400">2.10</p>
                </div>
                <div className="bg-white/5 rounded-lg p-2 text-center hover:bg-white/10 transition-colors cursor-pointer">
                  <p className="text-[10px] text-gray-500">X:</p>
                  <p className="text-sm font-bold text-white">3.20</p>
                </div>
                <div className="bg-white/5 rounded-lg p-2 text-center hover:bg-white/10 transition-colors cursor-pointer">
                  <p className="text-[10px] text-gray-500">2:</p>
                  <p className="text-sm font-bold text-emerald-400">2.80</p>
                </div>
              </div>
              <button className="w-full py-2 rounded-lg bg-yellow-500 text-black text-xs font-black hover:bg-yellow-400 transition-colors tracking-wider">
                HEMEN OYNA
              </button>
            </div>
          </div>

          {/* Öne Çıkan Kanallar */}
          <div className="bg-[#111827] rounded-xl border border-white/10 overflow-hidden flex-1">
            <div className="px-3 py-2 border-b border-white/10">
              <p className="text-[11px] font-bold text-white tracking-wider uppercase">ÖNE ÇIKAN KANALLAR</p>
            </div>
            <div className="p-2 space-y-1">
              {featuredChannels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => {
                    const chVideo = allVideos.find((v) => v.channelId === ch.youtubeChannelId);
                    if (chVideo) onZap('next');
                  }}
                  className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-white/5 transition-colors text-left group"
                >
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-lg font-bold shrink-0 overflow-hidden">
                    {ch.name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-white truncate group-hover:text-yellow-400 transition-colors">{ch.name}</p>
                    <p className="text-[10px] text-gray-600 truncate">{ch.description.substring(0, 35)}...</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM: HIZLI ZAP YAP Bar */}
      <div className="h-11 border-t border-yellow-500/30 flex items-center justify-center gap-4" style={{ background: 'linear-gradient(to right, #1a1a2e, #16213e, #1a1a2e)' }}>
        <button onClick={() => onZap('prev')} className="text-white text-sm font-bold hover:text-yellow-400 transition-colors">←</button>
        <div className="flex items-center gap-2">
          <span className="text-white font-black text-sm tracking-wider">HIZLI ZAP YAP</span>
          <span className="text-yellow-400 text-lg">⚡</span>
        </div>
        <button onClick={() => onZap('next')} className="text-white text-sm font-bold hover:text-yellow-400 transition-colors">→</button>
        <span className="text-[10px] text-gray-500 ml-4">Bu zap <span className="font-bold text-yellow-400">Nesine</span> ile</span>
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

      {/* Sponsor Ad Banner */}
      <AdBanner slot="sidebar" />
    </div>
  );
}

// =============================================
// LIVE BANNER
// =============================================
function LiveBanner({ liveVideos, onSelect, onMultiView }: { liveVideos: Video[]; onSelect: (v: Video) => void; onMultiView: (videos: Video[]) => void }) {
  return (
    <section className="mb-6 animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-500 flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${liveVideos.length > 0 ? 'bg-red-500 live-pulse' : 'bg-gray-600'}`}></span>
          <span className={liveVideos.length > 0 ? 'text-red-400 font-semibold' : 'text-gray-400 font-semibold'}>
            {liveVideos.length > 0 ? 'Şu An Canlı' : 'Canlı Yayınlar'}
          </span>
          {liveVideos.length > 0 && (
            <span className="text-gray-600 text-xs">({liveVideos.length} yayın)</span>
          )}
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

      {liveVideos.length === 0 ? (
        <div className="bg-[#1e293b] rounded-xl border border-white/5 p-6 text-center">
          <div className="text-3xl mb-2 opacity-40">📡</div>
          <p className="text-sm text-gray-400 font-medium">Şu an canlı yayın yok</p>
          <p className="text-xs text-gray-600 mt-1">Takip ettiğin kanallardan biri canlıya geçtiğinde burada görünecek</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-600"></span>
            <span className="text-[10px] text-gray-600">Kanallar kontrol ediliyor...</span>
          </div>
        </div>
      ) : (
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
      )}
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

  // TV Mode — auto-open on load
  const [tvBooted, setTvBooted] = useState(false);
  const [tvBootAnim, setTvBootAnim] = useState(true); // boot-up animation

  // Pre-roll ad state
  const [showPreroll, setShowPreroll] = useState(false);
  const [pendingVideo, setPendingVideo] = useState<Video | null>(null);

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

  // Fetch real videos from YouTube API (no mock fallback)
  useEffect(() => {
    if (filteredChannels.length === 0) {
      setVideos([]);
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
    const realChannels = filteredChannels.filter((ch) => ch.youtubeChannelId.startsWith('UC'));
    const channelYtIds = realChannels.map((ch) => ch.youtubeChannelId);

    if (!apiKey || channelYtIds.length === 0) {
      setVideos([]);
      return;
    }

    setLoading(true);
    getMultiChannelVideos(channelYtIds, apiKey, 3)
      .then((result) => {
        setVideos(result);
      })
      .catch(() => {
        setVideos([]);
      })
      .finally(() => setLoading(false));
  }, [filteredChannels]);

  // TV MODE: Auto-open first live stream (or latest video) when page loads
  useEffect(() => {
    if (tvBooted || videos.length === 0 || activeVideo) return;

    // Wait a tiny bit for boot animation to show
    const timer = setTimeout(() => {
      const live = videos.find((v) => v.live);
      if (live) {
        setActiveVideo(live);
      } else {
        // No live? Open the most recent video
        const sorted = [...videos].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
        if (sorted[0]) setActiveVideo(sorted[0]);
      }
      setTvBooted(true);
      // Hide boot animation after a short delay
      setTimeout(() => setTvBootAnim(false), 1800);
    }, 600);

    return () => clearTimeout(timer);
  }, [videos, tvBooted, activeVideo]);

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
      {/* TV Boot Animation Overlay */}
      {tvBootAnim && activeVideo && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black tv-boot-overlay">
          <div className="text-center tv-boot-content">
            <div className="text-6xl mb-4 animate-pulse">📺</div>
            <div className="flex items-center gap-2 justify-center mb-2">
              <div className="w-2 h-2 rounded-full bg-red-500 live-pulse"></div>
              <span className="text-sm font-bold text-white tracking-widest uppercase">ZapTube TV</span>
            </div>
            <p className="text-xs text-gray-500 animate-pulse">Kanal açılıyor...</p>
            <div className="mt-4 w-32 h-0.5 bg-gray-800 rounded mx-auto overflow-hidden">
              <div className="h-full bg-gradient-to-r from-red-500 to-emerald-400 tv-boot-bar" />
            </div>
          </div>
        </div>
      )}

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
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📺</span>
              <div>
                <h1 className="text-lg font-bold tracking-tight">
                  <span className="bg-gradient-to-r from-red-500 to-emerald-400 bg-clip-text text-transparent">Zap</span>Tube
                </h1>
              </div>
            </div>
            <nav className="flex items-center gap-1 ml-2">
              <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400">
                📺 Ana Sayfa
              </span>
              <Link href="/app/chat" className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
                💬 Sohbet
              </Link>
              <Link href="/app/twitter" className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
                🐦 Twitter
              </Link>
              <Link href="/app/channels" className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
                📡 Kanallar
              </Link>
              <Link href="/app/stats" className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
                📊 Reyting
              </Link>
            </nav>
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
                TV gibi aç, izle, zapla! Canlı yayın varsa otomatik açılır.
              </p>
              <p className="text-gray-600 text-xs mt-2">📺 Sayfa açıldığında TV gibi başlar · ← → ile kanal değiştir</p>
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
                <p className="text-sm">Henüz video yüklenemedi.</p>
                <p className="text-xs mt-1">YouTube API verileri çekiliyor, biraz bekle veya farklı filtre dene.</p>
              </div>
            )}
          </section>
        </div>

        {/* Right: Sidebar (hidden on mobile) */}
        <div className="hidden lg:block w-96 shrink-0">
          <div className="sticky top-20 space-y-4">
            <ChatPanel />
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
