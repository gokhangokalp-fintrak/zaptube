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
import UserProfileWidget from '@/components/UserProfileWidget';
import PollWidget from '@/components/PollWidget';
import LiveScoreWidget from '@/components/LiveScoreWidget';
import StandingsWidget from '@/components/StandingsWidget';
import FixturesWidget from '@/components/FixturesWidget';
import { TwitterFeedWidget } from '@/components/TwitterTimeline';

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
  const [chatInput, setChatInput] = useState('');
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [onlineCount] = useState(() => Math.floor(Math.random() * 2000) + 1200);
  const [zapFlash, setZapFlash] = useState(false);
  const [autoDirector, setAutoDirector] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const iframeRefs = useRef<(HTMLIFrameElement | null)[]>([]);

  // iOS-safe: tüm iframe'ler muted başlar, aktif olan postMessage ile unmute edilir
  useEffect(() => {
    const timer = setTimeout(() => {
      iframeRefs.current.forEach((iframe, idx) => {
        if (!iframe?.contentWindow) return;
        try {
          if (idx === activeAudioIndex) {
            iframe.contentWindow.postMessage('{"event":"command","func":"unMute","args":""}', '*');
            iframe.contentWindow.postMessage('{"event":"command","func":"setVolume","args":[100]}', '*');
          } else {
            iframe.contentWindow.postMessage('{"event":"command","func":"mute","args":""}', '*');
          }
        } catch {}
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [activeAudioIndex, videos.length]);

  // Auto Director — her 30sn rastgele başka kanala geç
  useEffect(() => {
    if (!autoDirector || videos.length <= 1) return;
    const interval = setInterval(() => {
      const nextIdx = (activeAudioIndex + 1 + Math.floor(Math.random() * (videos.length - 1))) % videos.length;
      onAudioSwitch(nextIdx);
      if (focusIndex !== null) setFocusIndex(nextIdx);
    }, 30000);
    return () => clearInterval(interval);
  }, [autoDirector, videos.length, activeAudioIndex, onAudioSwitch, focusIndex]);

  // Chat messages with reactions
  type ChatMsg = { user: string; msg: string; avatar: string; time: string; likes: number; pinned: boolean; reactions: Record<string, number> };
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([
    { user: 'Emre1905', msg: '8 kanal aynı anda, efsane!', avatar: '🦁', time: '21:30', likes: 12, pinned: false, reactions: { '🔥': 8, '👍': 4 } },
    { user: 'Fener41', msg: 'Hangi kanalda daha güzel analiz var?', avatar: '🐤', time: '21:31', likes: 8, pinned: false, reactions: { '👍': 3 } },
    { user: 'Arda34', msg: 'Ses geçişi çok iyi çalışıyor', avatar: '🦅', time: '21:32', likes: 5, pinned: false, reactions: { '💪': 5 } },
    { user: 'Sultan1907', msg: 'Bugün herkes canlı, süper akşam!', avatar: '🐤', time: '21:33', likes: 3, pinned: false, reactions: { '🔥': 2, '😂': 1 } },
    { user: 'ZapTube', msg: 'Ok tuşlarıyla kanallar arası geçiş yap! 1-8 ile direkt seç.', avatar: '⚡', time: '21:28', likes: 24, pinned: true, reactions: { '🔥': 24 } },
  ]);

  // Zap flash — kanal değiştirince sponsor overlay
  const prevAudioRef = useRef(activeAudioIndex);
  useEffect(() => {
    if (prevAudioRef.current !== activeAudioIndex) {
      prevAudioRef.current = activeAudioIndex;
      setZapFlash(true);
      const t = setTimeout(() => setZapFlash(false), 1200);
      return () => clearTimeout(t);
    }
  }, [activeAudioIndex]);

  // Reaction handler
  const handleReaction = (msgIdx: number, emoji: string) => {
    setChatMessages(prev => prev.map((m, i) => {
      if (i !== msgIdx) return m;
      const newReactions = { ...m.reactions };
      newReactions[emoji] = (newReactions[emoji] || 0) + 1;
      return { ...m, reactions: newReactions, likes: m.likes + 1 };
    }));
  };

  // Auto-pin: en çok reaction alan mesaj otomatik sabitlensin
  const topReactionMsg = useMemo(() => {
    const nonPinned = chatMessages.filter(m => !m.pinned);
    if (nonPinned.length === 0) return null;
    const sorted = [...nonPinned].sort((a, b) => b.likes - a.likes);
    return sorted[0]?.likes >= 10 ? sorted[0] : null;
  }, [chatMessages]);

  // 5+ video → otomatik focus mode başlat
  useEffect(() => {
    if (videos.length > 4 && focusIndex === null) {
      setFocusIndex(0);
    }
  }, [videos.length]);

  // Keyboard navigation — ok tuşlarıyla video geçişi
  useEffect(() => {
    if (videos.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (focusIndex !== null && videos.length <= 4) { setFocusIndex(null); } else { onClose(); }
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIdx = (activeAudioIndex + 1) % videos.length;
        onAudioSwitch(nextIdx);
        if (focusIndex !== null) setFocusIndex(nextIdx);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIdx = (activeAudioIndex - 1 + videos.length) % videos.length;
        onAudioSwitch(prevIdx);
        if (focusIndex !== null) setFocusIndex(prevIdx);
      } else if (e.key >= '1' && e.key <= '8') {
        const idx = parseInt(e.key) - 1;
        if (idx < videos.length) {
          e.preventDefault();
          onAudioSwitch(idx);
          if (focusIndex !== null) setFocusIndex(idx);
        }
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (videos.length <= 4) {
          setFocusIndex(prev => prev !== null ? null : activeAudioIndex);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [videos.length, activeAudioIndex, onAudioSwitch, onClose, focusIndex]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  if (videos.length === 0) return null;

  const handleChatSend = () => {
    if (!chatInput.trim()) return;
    setChatMessages(prev => [...prev, {
      user: 'Sen', msg: chatInput.trim(), avatar: '⚡', likes: 0, pinned: false, reactions: {},
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    }]);
    setChatInput('');
  };

  const isFocusMode = focusIndex !== null;
  const pinnedMsg = chatMessages.find(m => m.pinned);

  // 5+ video → her zaman focus mode (1 büyük + alt bar)
  // 1-4 video → normal grid veya focus mode (F ile toggle)
  const forceFocus = videos.length > 4;
  const gridClass = videos.length === 1 ? 'grid-cols-1' : 'grid-cols-2';
  const gridRows = videos.length <= 2 ? 'grid-rows-1' : 'grid-rows-2';

  return (
    <div className="fixed inset-0 z-[100] animate-fade-in flex flex-col" style={{ background: 'rgba(0,0,0,0.97)' }}>
      {/* ZAP FLASH — kanal değiştirince sponsor overlay */}
      {zapFlash && (
        <div className="absolute inset-0 z-[110] pointer-events-none flex items-center justify-center" style={{ animation: 'zapFlash 1.2s ease-out forwards' }}>
          <div className="bg-black/70 backdrop-blur-sm px-6 py-3 rounded-2xl flex items-center gap-3" style={{ animation: 'zapScale 0.3s ease-out' }}>
            <span className="text-2xl">⚡</span>
            <div>
              <p className="text-white font-bold text-sm">ZAP!</p>
              <p className="text-emerald-400 text-[10px] font-medium">Nesine ile kanal değiştir</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-2 border-b border-white/10 shrink-0 gap-2" style={{ background: 'rgba(17,24,39,0.95)' }}>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className="text-lg">📺</span>
          <h2 className="text-sm font-bold text-white">Çoklu İzleme</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
            {videos.length} kanal
          </span>

          {/* Focus Mode toggle — sadece 4 ve altı video için */}
          {videos.length <= 4 && (
            <button
              onClick={() => setFocusIndex(prev => prev !== null ? null : activeAudioIndex)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                isFocusMode
                  ? 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {isFocusMode ? '⊞ Çoklu' : '⊡ Tek'}
            </button>
          )}

          {/* Auto Director toggle */}
          <button
            onClick={() => setAutoDirector(prev => !prev)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
              autoDirector
                ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30 animate-pulse'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {autoDirector ? '🎬 ON' : '🎬 Zap'}
          </button>

          <span className="text-[10px] text-gray-600 hidden lg:block">← → geçiş | 1-{videos.length} seç | {videos.length <= 4 ? 'F focus | ' : ''}ESC kapat</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Kanal ses seçici — büyütülmüş */}
          <div className="hidden sm:flex items-center gap-1 overflow-x-auto max-w-xs md:max-w-lg">
            {videos.map((v, i) => (
              <button
                key={v.id}
                onClick={() => { onAudioSwitch(i); if (focusIndex !== null) setFocusIndex(i); }}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all shrink-0 ${
                  i === activeAudioIndex
                    ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'
                    : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white'
                }`}
              >
                {i === activeAudioIndex ? '🔊' : '🔇'} {v.channelTitle}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-red-500/30 text-white text-sm transition-colors flex-shrink-0">
            ✕
          </button>
        </div>
      </div>

      {/* Sponsor Bar — video altı ticker */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-6 px-4 py-1 shrink-0 border-b border-white/5" style={{ background: 'rgba(17,24,39,0.7)' }}>
        <span className="text-[9px] text-gray-600">SPONSOR</span>
        <span className="text-[10px] text-emerald-400/80 font-medium text-center">⚡ Bu yayın <strong>Nesine.com</strong> sponsorluğunda</span>
        <span className="text-[10px] text-gray-600 hidden sm:inline">|</span>
        <span className="text-[10px] text-orange-400/80 font-medium text-center">📺 Maçlar <strong>beIN SPORTS</strong>&apos;ta</span>
      </div>

      {/* 3-Column Layout: Chat | Videos | Ad */}
      <div className="flex flex-1 min-h-0">

        {/* LEFT: Canlı Sohbet — güçlendirilmiş */}
        <div className="hidden lg:flex w-72 xl:w-80 shrink-0 flex-col border-r border-white/5" style={{ background: 'rgba(15,23,36,0.95)' }}>
          {/* Chat Header — büyütülmüş */}
          <div className="px-3 py-3 border-b border-white/10 shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-base">💬</span>
                <span className="text-sm font-bold text-white">Canlı Sohbet</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block mr-1 live-pulse"></span>
                CANLI
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-yellow-400 font-bold">{onlineCount.toLocaleString('tr-TR')} kisi sohbet ediyor 🔥</span>
            </div>
          </div>

          {/* Pinned message */}
          {pinnedMsg && (
            <div className="px-3 py-2 border-b border-yellow-500/10 bg-yellow-500/5 shrink-0">
              <div className="flex items-start gap-2">
                <span className="text-xs">📌</span>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold text-yellow-400">{pinnedMsg.user}</span>
                  <p className="text-xs text-yellow-200/80 leading-snug">{pinnedMsg.msg}</p>
                  {Object.entries(pinnedMsg.reactions).length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {Object.entries(pinnedMsg.reactions).map(([emoji, count]) => (
                        <span key={emoji} className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-300">{emoji} {count}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Top reaction mesajı — auto-pin */}
          {topReactionMsg && !topReactionMsg.pinned && (
            <div className="px-3 py-2 border-b border-orange-500/10 bg-orange-500/5 shrink-0">
              <div className="flex items-start gap-2">
                <span className="text-xs">🏆</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-[10px] font-bold text-orange-400">{topReactionMsg.user}</span>
                    <span className="text-[9px] text-orange-500/40">en popüler</span>
                  </div>
                  <p className="text-xs text-orange-200/80 leading-snug">{topReactionMsg.msg}</p>
                  <div className="flex gap-1 mt-1">
                    {Object.entries(topReactionMsg.reactions).map(([emoji, count]) => (
                      <span key={emoji} className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-300">{emoji} {count}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Chat Messages — reaction destekli */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
            {chatMessages.filter(m => !m.pinned).map((msg, msgIdx) => {
              const actualIdx = chatMessages.indexOf(msg);
              return (
                <div key={msgIdx} className="flex gap-2.5 group/msg">
                  <span className="text-lg shrink-0">{msg.avatar}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-bold text-yellow-400">{msg.user}</span>
                      <span className="text-[10px] text-gray-600">{msg.time}</span>
                    </div>
                    <p className="text-sm text-gray-200 leading-relaxed break-words">{msg.msg}</p>
                    {/* Reactions display */}
                    {Object.entries(msg.reactions).length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {Object.entries(msg.reactions).map(([emoji, count]) => (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(actualIdx, emoji)}
                            className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                          >
                            {emoji} {count}
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Reaction buttons — hover */}
                    <div className="flex gap-0.5 mt-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                      {['👍', '😂', '🔥', '💪', '❤️'].map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(actualIdx, emoji)}
                          className="text-xs px-1 py-0.5 rounded hover:bg-white/10 transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Sponsor */}
          <div className="px-3 py-1 border-t border-white/5 bg-emerald-500/5 shrink-0">
            <span className="text-[9px] text-emerald-500/60">Sohbet Sponsoru: <strong className="text-emerald-400/80">Nesine.com</strong> — Hemen Oyna!</span>
          </div>

          {/* Chat Input — büyütülmüş */}
          <div className="p-2.5 border-t border-white/10 shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleChatSend()}
                placeholder="Mesaj yaz..."
                className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-yellow-500/40 focus:bg-white/[0.07] transition-all"
              />
              <button
                onClick={handleChatSend}
                className="px-4 py-2.5 bg-yellow-500/20 text-yellow-400 rounded-lg text-xs font-bold hover:bg-yellow-500/30 transition-colors shrink-0"
              >
                Gönder
              </button>
            </div>
          </div>
        </div>

        {/* CENTER: Video Grid veya Focus Mode */}
        <div className="flex-1 min-w-0 p-1 flex flex-col">
          {(isFocusMode || forceFocus) && focusIndex !== null ? (
            /* ====== FOCUS MODE — tüm iframe'ler aynı anda yüklü, CSS ile geçiş (iOS autoplay koruması) ====== */
            <>
              {/* Ana büyük video — TÜM iframe'ler render edilir, sadece aktif olan görünür */}
              <div className="flex-1 relative rounded-lg overflow-hidden mb-1">
                {videos.map((video, idx) => {
                  const videoId = video.ytVideoId || extractVideoId(video.url);
                  const isVisible = idx === focusIndex;
                  return (
                    <div key={video.id} className={`absolute inset-0 transition-opacity duration-200 ${isVisible ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                      <iframe
                        ref={(el) => { iframeRefs.current[idx] = el; }}
                        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&mute=1`}
                        title={video.title}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  );
                })}
                {/* Üst bar: kanal adı + rozetler — aktif video bilgisi */}
                {focusIndex !== null && videos[focusIndex] && (
                  <>
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-none">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1.5 rounded-lg bg-emerald-500/30 text-emerald-300 text-sm font-bold backdrop-blur-sm">
                          🔊 {videos[focusIndex].channelTitle}
                        </span>
                        {videos[focusIndex].live && (
                          <span className="px-2 py-1 rounded bg-red-600 text-white text-[10px] font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-white live-pulse"></span> CANLI
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded-lg bg-black/60 text-[10px] text-red-400 font-bold backdrop-blur-sm flex items-center gap-1">
                          🔥 {(onlineCount + Math.floor(Math.random() * 200)).toLocaleString('tr-TR')} kişi burada
                        </span>
                        {focusIndex === 0 && (
                          <span className="px-2 py-1 rounded-lg bg-yellow-500/20 text-[10px] text-yellow-400 font-bold backdrop-blur-sm">
                            ⚡ En çok izlenen
                          </span>
                        )}
                        {videos.length >= 4 && focusIndex >= videos.length - 2 && (
                          <span className="px-2 py-1 rounded-lg bg-purple-500/20 text-[10px] text-purple-400 font-bold backdrop-blur-sm">
                            💥 Trend
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="absolute bottom-3 right-3 z-20 pointer-events-none">
                      <span className="px-2.5 py-1 rounded-lg bg-black/60 text-[10px] text-emerald-400/80 font-medium backdrop-blur-sm">
                        ⚡ Nesine sponsorluğunda
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Alt preview strip — glow efektli, yatay scroll */}
              <div className="flex gap-1.5 h-16 sm:h-24 shrink-0 overflow-x-auto px-1 py-1" style={{ scrollSnapType: 'x mandatory' }}>
                {videos.map((video, idx) => {
                  const videoId = video.ytVideoId || extractVideoId(video.url);
                  const isFocused = idx === focusIndex;
                  const isAudio = idx === activeAudioIndex;
                  return (
                    <button
                      key={video.id}
                      onClick={() => { setFocusIndex(idx); onAudioSwitch(idx); }}
                      className={`relative shrink-0 rounded-lg overflow-hidden transition-all duration-300 ${
                        videos.length <= 4 ? 'flex-1' : 'w-40'
                      } ${
                        isFocused
                          ? 'ring-2 ring-emerald-400 opacity-100 scale-105 shadow-lg shadow-emerald-500/30'
                          : 'opacity-40 hover:opacity-75 scale-95'
                      }`}
                      style={{ scrollSnapAlign: 'start' }}
                    >
                      {/* Thumbnail yerine iframe — ama 5+ de thumbnail kullan (performans) */}
                      {videos.length <= 4 ? (
                        <iframe
                          ref={(el) => { iframeRefs.current[idx] = el; }}
                          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&mute=1&controls=0`}
                          title={video.title}
                          className="w-full h-full pointer-events-none"
                          allow="autoplay"
                        />
                      ) : (
                        <div className="w-full h-full relative">
                          {video.thumbnail ? (
                            <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900" />
                          )}
                        </div>
                      )}
                      {/* Kanal adı + ses ikonu overlay */}
                      <div className="absolute inset-0 flex items-end">
                        <div className={`w-full px-2 py-1.5 ${isFocused ? 'bg-gradient-to-t from-emerald-900/90 to-transparent' : 'bg-gradient-to-t from-black/90 to-transparent'}`}>
                          <p className={`text-[10px] font-bold truncate ${isFocused ? 'text-emerald-300' : 'text-gray-400'}`}>
                            {isAudio ? '🔊' : `${idx + 1}`} {video.channelTitle}
                          </p>
                        </div>
                      </div>
                      {/* Glow efekti — aktif kanal */}
                      {isFocused && (
                        <div className="absolute inset-0 rounded-lg pointer-events-none" style={{ boxShadow: 'inset 0 0 20px rgba(16, 185, 129, 0.15)' }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            /* ====== NORMAL MODE — 2x2 grid ====== */
            <div className={`grid h-full ${gridClass} ${gridRows} gap-1`}>
              {videos.map((video, idx) => {
                const videoId = video.ytVideoId || extractVideoId(video.url);
                const isAudioActive = idx === activeAudioIndex;
                const spanClass = videos.length === 3 && idx === 2 ? 'col-span-2' : '';

                return (
                  <div
                    key={video.id}
                    className={`relative group rounded-lg overflow-hidden cursor-pointer ${spanClass} ${
                      isAudioActive ? 'ring-2 ring-emerald-500/50' : ''
                    }`}
                    onDoubleClick={() => { setFocusIndex(idx); onAudioSwitch(idx); }}
                  >
                    <iframe
                      ref={(el) => { iframeRefs.current[idx] = el; }}
                      src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&mute=1`}
                      title={video.title}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                    {/* Kanal adı — HER ZAMAN görünür, büyütülmüş */}
                    <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent px-3 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          isAudioActive ? 'bg-emerald-500/40 text-emerald-300' : 'bg-black/50 text-white/90'
                        }`}>
                          {isAudioActive ? '🔊' : idx + 1}
                        </span>
                        <span className="text-sm font-bold text-white drop-shadow-lg">{video.channelTitle}</span>
                        {video.live && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-600 text-white text-[9px] font-bold">
                            <span className="w-1 h-1 rounded-full bg-white live-pulse"></span>CANLI
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => { setFocusIndex(idx); onAudioSwitch(idx); }}
                        className="px-1.5 py-0.5 rounded text-[9px] bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                        title="Focus mode"
                      >
                        ⊡
                      </button>
                    </div>

                    {/* Alt kontroller — hover */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-gray-300 truncate flex-1">{video.title}</p>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
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
                            className="px-1.5 py-1 rounded text-[10px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: Reklam + Kanal Paneli */}
        <div className="hidden xl:flex w-56 shrink-0 flex-col border-l border-white/5 p-3 gap-3" style={{ background: 'rgba(15,23,36,0.95)' }}>
          {/* Sponsor banner */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
            <span className="text-[9px] text-emerald-500/60 font-medium">SPONSOR</span>
            <div className="mt-2 mb-2">
              <span className="text-2xl">⚽</span>
            </div>
            <p className="text-xs text-emerald-400 font-bold">Nesine.com</p>
            <p className="text-[10px] text-gray-500 mt-1">İddaa&apos;da en yüksek oranlar</p>
            <a href="https://www.nesine.com" target="_blank" rel="noopener noreferrer"
              className="mt-2 block px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold hover:bg-emerald-500/30 transition-colors">
              Hemen Oyna →
            </a>
          </div>

          {/* beIN SPORTS */}
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 text-center">
            <span className="text-[9px] text-orange-500/60 font-medium">YAYINCI</span>
            <div className="mt-2 mb-2"><span className="text-2xl">📺</span></div>
            <p className="text-xs text-orange-400 font-bold">beIN SPORTS</p>
            <p className="text-[10px] text-gray-500 mt-1">Tüm maclar tek yerde</p>
            <a href="https://www.beinsports.com.tr" target="_blank" rel="noopener noreferrer"
              className="mt-2 block px-3 py-1.5 bg-orange-500/20 text-orange-400 rounded-lg text-[10px] font-bold hover:bg-orange-500/30 transition-colors">
              İzle →
            </a>
          </div>

          {/* Kanal listesi — büyütülmüş */}
          <div className="flex-1 overflow-y-auto">
            <p className="text-[10px] text-gray-600 font-medium mb-2">YAYINDA OLAN KANALLAR</p>
            {videos.map((v, i) => (
              <button
                key={v.id}
                onClick={() => { onAudioSwitch(i); if (isFocusMode) setFocusIndex(i); }}
                className={`w-full text-left px-2.5 py-2.5 rounded-lg mb-1.5 transition-all ${
                  i === activeAudioIndex
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold w-5 text-center ${i === activeAudioIndex ? 'text-emerald-400' : 'text-gray-500'}`}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">{v.channelTitle}</p>
                    <p className="text-[9px] text-gray-600 truncate mt-0.5">{v.title}</p>
                  </div>
                  {i === activeAudioIndex && <span className="text-sm">🔊</span>}
                </div>
              </button>
            ))}
          </div>

          {/* Alt reklam alanı */}
          <div className="rounded-xl border border-dashed border-white/10 p-3 text-center">
            <span className="text-[9px] text-gray-600">REKLAM ALANI</span>
            <p className="text-[10px] text-gray-700 mt-1">300x250</p>
          </div>
        </div>
      </div>

      {/* MOBILE CHAT — FAB + overlay (lg altında görünür) */}
      <button
        onClick={() => setMobileChatOpen(true)}
        className="lg:hidden fixed bottom-4 right-4 z-[110] w-12 h-12 rounded-full bg-yellow-500/90 text-black flex items-center justify-center shadow-lg shadow-yellow-500/30 active:scale-95 transition-transform"
      >
        <span className="text-lg">💬</span>
        {chatMessages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {chatMessages.filter(m => !m.pinned).length}
          </span>
        )}
      </button>

      {mobileChatOpen && (
        <div className="lg:hidden fixed inset-0 z-[120] flex flex-col">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileChatOpen(false)} />

          {/* Chat drawer — alttan %70 */}
          <div className="absolute bottom-0 left-0 right-0 max-h-[75vh] flex flex-col animate-drawer-up" style={{ background: 'rgba(15,23,36,0.98)' }}>
            {/* Handle + Header */}
            <div className="flex flex-col items-center pt-2 pb-1 border-b border-white/10 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20 mb-2" />
              <div className="w-full px-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">💬</span>
                  <span className="text-sm font-bold text-white">Canlı Sohbet</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block mr-1 live-pulse"></span>
                    CANLI
                  </span>
                </div>
                <button onClick={() => setMobileChatOpen(false)} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white text-sm">✕</button>
              </div>
              <span className="text-[10px] text-yellow-400 font-bold mt-1">{onlineCount.toLocaleString('tr-TR')} kişi sohbet ediyor 🔥</span>
            </div>

            {/* Pinned */}
            {pinnedMsg && (
              <div className="px-4 py-2 border-b border-yellow-500/10 bg-yellow-500/5 shrink-0">
                <div className="flex items-start gap-2">
                  <span className="text-xs">📌</span>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-yellow-400">{pinnedMsg.user}</span>
                    <p className="text-xs text-yellow-200/80 leading-snug">{pinnedMsg.msg}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
              {chatMessages.filter(m => !m.pinned).map((msg, msgIdx) => {
                const actualIdx = chatMessages.indexOf(msg);
                return (
                  <div key={msgIdx} className="flex gap-2.5">
                    <span className="text-lg shrink-0">{msg.avatar}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-bold text-yellow-400">{msg.user}</span>
                        <span className="text-[10px] text-gray-600">{msg.time}</span>
                      </div>
                      <p className="text-sm text-gray-200 leading-relaxed break-words">{msg.msg}</p>
                      {Object.entries(msg.reactions).length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {Object.entries(msg.reactions).map(([emoji, count]) => (
                            <button key={emoji} onClick={() => handleReaction(actualIdx, emoji)}
                              className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-400">
                              {emoji} {count}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-1 mt-1">
                        {['👍', '😂', '🔥', '💪', '❤️'].map((emoji) => (
                          <button key={emoji} onClick={() => handleReaction(actualIdx, emoji)}
                            className="text-sm px-1.5 py-1 rounded hover:bg-white/10 transition-colors">
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-white/10 shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleChatSend()}
                  placeholder="Mesaj yaz..."
                  className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-yellow-500/40"
                />
                <button onClick={handleChatSend}
                  className="px-4 py-2.5 bg-yellow-500/20 text-yellow-400 rounded-lg text-xs font-bold hover:bg-yellow-500/30 transition-colors shrink-0">
                  Gönder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
// =============================================
// RESUME HELPERS — localStorage ile kaldığın yerden devam
// =============================================
const RESUME_STORAGE_KEY = 'zaptube_resume';

function saveVideoProgress(videoId: string, currentTime: number) {
  try {
    const data = JSON.parse(localStorage.getItem(RESUME_STORAGE_KEY) || '{}');
    data[videoId] = { time: Math.floor(currentTime), updatedAt: Date.now() };
    // Keep only last 50 entries
    const entries = Object.entries(data);
    if (entries.length > 50) {
      const sorted = entries.sort((a: any, b: any) => b[1].updatedAt - a[1].updatedAt);
      const trimmed = Object.fromEntries(sorted.slice(0, 50));
      localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(trimmed));
    } else {
      localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(data));
    }
  } catch {}
}

function getVideoProgress(videoId: string): number {
  try {
    const data = JSON.parse(localStorage.getItem(RESUME_STORAGE_KEY) || '{}');
    const entry = data[videoId];
    if (entry && entry.time > 10) {
      // Only resume if > 10 seconds in (skip intros etc)
      return entry.time;
    }
  } catch {}
  return 0;
}

function clearVideoProgress(videoId: string) {
  try {
    const data = JSON.parse(localStorage.getItem(RESUME_STORAGE_KEY) || '{}');
    delete data[videoId];
    localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

function PlayerModal({
  video,
  onClose,
  allVideos,
  onZap,
  onVideoEnd,
  autoplayNext,
  onAutoplayNextToggle,
}: {
  video: Video | null;
  onClose: () => void;
  allVideos: Video[];
  onZap: (direction: 'prev' | 'next') => void;
  onVideoEnd: () => void;
  autoplayNext: boolean;
  onAutoplayNextToggle: () => void;
}) {
  // ALL hooks MUST be called before any conditional return (React Rules of Hooks)
  const playerRef = useRef<any>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const [resumeTime, setResumeTime] = useState<number>(0);
  const [showResumeToast, setShowResumeToast] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [playerReady, setPlayerReady] = useState(false);

  const videoId = video ? (video.ytVideoId || extractVideoId(video.url)) : '';
  const currentIdx = video ? allVideos.findIndex((v) => v.id === video.id) : -1;

  // Check for saved progress when video changes
  useEffect(() => {
    if (!videoId) return;
    const saved = getVideoProgress(videoId);
    setResumeTime(saved);
    setShowResumeToast(saved > 0);
    setCountdown(null);
    setPlayerReady(false);
    if (saved > 0) {
      const timer = setTimeout(() => setShowResumeToast(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [videoId]);

  // Save progress periodically while playing
  useEffect(() => {
    if (!videoId) return;
    progressIntervalRef.current = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        try {
          const time = playerRef.current.getCurrentTime();
          const duration = playerRef.current.getDuration();
          if (time > 5 && duration > 0 && (duration - time) > 30) {
            saveVideoProgress(videoId, time);
          }
        } catch {}
      }
    }, 5000);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [videoId]);

  // Cleanup countdown on unmount or video change
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [videoId]);

  // Load YouTube IFrame API once
  const playerInitialized = useRef(false);
  const currentVideoIdRef = useRef('');

  useEffect(() => {
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScript = document.getElementsByTagName('script')[0];
      firstScript?.parentNode?.insertBefore(tag, firstScript);
    }
  }, []);

  // Create player once, then use loadVideoById for subsequent videos (iOS autoplay fix)
  useEffect(() => {
    if (!videoId || !video) return;

    let destroyed = false;
    const startTime = resumeTime;

    // If player already exists and is ready, just switch video (no destroy!)
    if (playerRef.current && playerInitialized.current && currentVideoIdRef.current !== videoId) {
      currentVideoIdRef.current = videoId;
      try {
        if (startTime > 0) {
          playerRef.current.loadVideoById({ videoId, startSeconds: startTime });
        } else {
          playerRef.current.loadVideoById(videoId);
        }
        setPlayerReady(true);
      } catch {
        // If loadVideoById fails, fall through to recreate
        playerInitialized.current = false;
      }
      if (playerInitialized.current) return; // Successfully switched
    }

    // First time or recovery: create the player
    const initPlayer = () => {
      if (destroyed) return;

      // Destroy previous player safely
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
        playerInitialized.current = false;
      }

      const container = document.getElementById('yt-player-container');
      if (!container) {
        setTimeout(() => { if (!destroyed) initPlayer(); }, 200);
        return;
      }

      try {
        currentVideoIdRef.current = videoId;
        playerRef.current = new (window as any).YT.Player('yt-player-container', {
          videoId: videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            start: startTime || undefined,
          },
          events: {
            onReady: () => {
              if (!destroyed) {
                setPlayerReady(true);
                playerInitialized.current = true;
              }
            },
            onStateChange: (event: any) => {
              if (destroyed) return;
              if (event.data === 0) {
                clearVideoProgress(currentVideoIdRef.current);
                if (autoplayNext && allVideos.length > 1) {
                  let count = 5;
                  setCountdown(count);
                  countdownRef.current = setInterval(() => {
                    count--;
                    setCountdown(count);
                    if (count <= 0) {
                      if (countdownRef.current) clearInterval(countdownRef.current);
                      setCountdown(null);
                      onVideoEnd();
                    }
                  }, 1000);
                }
              } else if (event.data === 1) {
                if (countdownRef.current) {
                  clearInterval(countdownRef.current);
                  setCountdown(null);
                }
              }
            },
            onError: (event: any) => {
              console.warn('YT Player error:', event.data);
            },
          },
        });
      } catch (err) {
        console.warn('Failed to create YT player:', err);
      }
    };

    if ((window as any).YT && (window as any).YT.Player) {
      setTimeout(initPlayer, 150);
    } else {
      (window as any).onYouTubeIframeAPIReady = () => {
        if (!destroyed) setTimeout(initPlayer, 100);
      };
    }

    return () => {
      destroyed = true;
      // Don't destroy player on video change — reuse it!
      // Only destroy when component unmounts (video becomes null)
    };
  }, [videoId]); // Switch video without destroying player

  // Cleanup player when modal closes
  useEffect(() => {
    if (!video && playerRef.current) {
      try { playerRef.current.destroy(); } catch {}
      playerRef.current = null;
      playerInitialized.current = false;
      currentVideoIdRef.current = '';
    }
  }, [video]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!video) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') onZap('prev');
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') onZap('next');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [video, onClose, onZap]);

  // NOW we can do conditional return — AFTER all hooks
  if (!video) return null;

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
          <ChatPanel />
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

          {/* Player — YouTube IFrame API */}
          <div className="flex-1 bg-black rounded-b-xl overflow-hidden border border-white/10 border-t-0 relative">
            <div id="yt-player-container" className="w-full h-full channel-switch" />

            {/* Resume Toast */}
            {showResumeToast && resumeTime > 0 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-xl bg-black/80 border border-emerald-500/30 backdrop-blur-sm animate-fade-in z-10">
                <span className="text-emerald-400 text-sm">▶</span>
                <span className="text-xs text-gray-300">
                  Kaldığın yerden devam: <span className="text-white font-bold">{Math.floor(resumeTime / 60)}:{String(resumeTime % 60).padStart(2, '0')}</span>
                </span>
              </div>
            )}

            {/* Autoplay Next Countdown */}
            {countdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20 animate-fade-in">
                <div className="text-center">
                  <p className="text-sm text-gray-400 mb-2">Sonraki video başlıyor...</p>
                  <div className="w-20 h-20 rounded-full border-4 border-emerald-500 flex items-center justify-center mb-3">
                    <span className="text-3xl font-bold text-white">{countdown}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    {currentIdx + 1 < allVideos.length ? allVideos[currentIdx + 1]?.title?.slice(0, 50) : allVideos[0]?.title?.slice(0, 50)}...
                  </p>
                  <button
                    onClick={() => {
                      if (countdownRef.current) clearInterval(countdownRef.current);
                      setCountdown(null);
                    }}
                    className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-gray-300 transition-colors"
                  >
                    İptal
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Autoplay Next Toggle */}
          <div className="flex items-center justify-between bg-[#111827] rounded-xl px-3 py-1.5 mt-1 border border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-sm">🔄</span>
              <span className="text-[11px] text-gray-400">Otomatik Sonraki Video</span>
            </div>
            <button
              onClick={onAutoplayNextToggle}
              className={`relative w-10 h-5 rounded-full transition-colors ${autoplayNext ? 'bg-emerald-500' : 'bg-gray-700'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${autoplayNext ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {/* İnce uzun sponsor banner — video altı */}
          <AdBanner slot="stream-bottom" className="mt-1" />
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

          {/* Twitter Akışı + Sponsor */}
          <div className="flex-1 flex flex-col gap-1 min-h-0">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Tweet Akışı Sponsoru</span>
              <span className="text-[10px] text-yellow-500/60 font-medium">REKLAM</span>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <TwitterFeedWidget />
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

      {/* Twitter Feed with Sponsor */}
      <div className="space-y-1">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Tweet Akışı Sponsoru</span>
          <span className="text-[10px] text-yellow-500/60 font-medium">REKLAM</span>
        </div>
        <TwitterFeedWidget />
      </div>

      {/* Sponsor Ad Banner */}
      <AdBanner slot="sidebar" />
    </div>
  );
}

// =============================================
// LIVE EMPTY STATE — time-aware messaging
// =============================================
function LiveEmptyState() {
  const hour = new Date().getHours();

  // Gerçek yayın paternine göre mesajlar
  // 02-10: ölü saat — kimse yayın yapmaz
  // 10-12: nadir — ara sıra erken yayın olabilir
  // 12-17: öğlen — bazı kanallar başlar
  // 17-20: yoğunlaşma — maç öncesi
  // 20-02: pik — maçlar + post-maç
  let emoji: string, message: string, subMessage: string, checkInfo: string;

  if (hour >= 2 && hour < 10) {
    emoji = '🌙';
    message = 'Yayıncılar şu an uyuyor';
    subMessage = 'Öğleden sonra yayınlar başlayacak';
    checkInfo = '2 saatte bir kontrol ediliyor';
  } else if (hour >= 10 && hour < 12) {
    emoji = '☀️';
    message = 'Henüz yayın başlamadı';
    subMessage = 'Bazı kanallar öğlen saatlerinde yayına başlıyor';
    checkInfo = '30 dakikada bir kontrol ediliyor';
  } else if (hour >= 12 && hour < 17) {
    emoji = '📡';
    message = 'Yayınlar kontrol ediliyor';
    subMessage = 'Kanallar canlıya geçtiğinde otomatik görünecek';
    checkInfo = '15 dakikada bir kontrol ediliyor';
  } else if (hour >= 17 && hour < 20) {
    emoji = '📺';
    message = 'Yayınlar yakında başlayacak';
    subMessage = 'Maç saati yaklaşıyor, kanallar hazırlanıyor';
    checkInfo = '5 dakikada bir kontrol ediliyor';
  } else {
    // 20-02 pik saat
    emoji = '📺';
    message = 'Yayınlar yakında başlayacak';
    subMessage = 'Kanallar kontrol ediliyor, canlı yayın başladığında otomatik görünecek';
    checkInfo = '3 dakikada bir kontrol ediliyor';
  }

  return (
    <div className="bg-[#1e293b] rounded-xl border border-white/5 p-4 text-center">
      <div className="flex items-center justify-center gap-2">
        <span className="text-lg opacity-50">{emoji}</span>
        <p className="text-sm text-gray-400 font-medium">{message}</p>
      </div>
      <p className="text-xs text-gray-600 mt-1">{subMessage}</p>
      <div className="flex items-center justify-center gap-2 mt-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 animate-pulse"></span>
        <span className="text-[10px] text-gray-600">{checkInfo}</span>
      </div>
    </div>
  );
}

// =============================================
// LIVE BANNER
// =============================================
function LiveBanner({ liveVideos, onSelect, onMultiView }: { liveVideos: Video[]; onSelect: (v: Video) => void; onMultiView: (videos: Video[]) => void }) {
  const [selectedLive, setSelectedLive] = useState<Video[]>([]);

  const toggleSelect = (video: Video) => {
    setSelectedLive((prev) => {
      const exists = prev.find((v) => v.id === video.id);
      if (exists) return prev.filter((v) => v.id !== video.id);
      if (prev.length >= 8) return prev; // Max 8
      return [...prev, video];
    });
  };

  const startMultiView = () => {
    if (selectedLive.length === 0) return;
    onMultiView(selectedLive);
    setSelectedLive([]);
  };

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
          <div className="flex items-center gap-2">
            {selectedLive.length > 0 ? (
              <>
                <span className="text-[10px] text-gray-500">{selectedLive.length} seçildi</span>
                <button
                  onClick={() => setSelectedLive([])}
                  className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-gray-500 hover:text-white transition-colors"
                >
                  Temizle
                </button>
                <button
                  onClick={startMultiView}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/30 transition-colors animate-pulse"
                >
                  📺 Çoklu İzle ({selectedLive.length})
                </button>
              </>
            ) : (
              <span className="text-[10px] text-gray-600">Kartlara tıklayarak seç, çoklu izle</span>
            )}
          </div>
        )}
      </div>

      {liveVideos.length === 0 ? (
        <LiveEmptyState />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollSnapType: 'x mandatory' }}>
          {liveVideos.map((video) => {
            const isSelected = selectedLive.find((v) => v.id === video.id);
            const selectIdx = selectedLive.findIndex((v) => v.id === video.id);
            return (
              <div key={video.id} className="flex-shrink-0 w-64 sm:w-72 relative" style={{ scrollSnapAlign: 'start' }}>
                <button
                  onClick={() => liveVideos.length >= 2 ? toggleSelect(video) : onSelect(video)}
                  className={`w-full bg-gradient-to-br from-red-950/40 to-[#1e293b] hover:from-red-950/60 rounded-xl overflow-hidden transition-all hover:scale-[1.02] group text-left ${
                    isSelected
                      ? 'border-2 border-emerald-500 ring-2 ring-emerald-500/20'
                      : 'border border-red-500/20 hover:border-red-500/40'
                  }`}
                >
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
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm font-bold shadow-lg">
                        {selectIdx + 1}
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2 text-[10px] text-white/70 bg-black/60 px-1.5 py-0.5 rounded">
                      {formatViewCount(video.viewCount)} izliyor
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium line-clamp-2 group-hover:text-red-400 transition-colors leading-snug">{video.title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[11px] text-gray-500">{video.channelTitle}</p>
                      {isSelected && (
                        <span className="text-[10px] text-emerald-400 font-bold">✓ Seçildi</span>
                      )}
                    </div>
                  </div>
                </button>
                {/* Tek izle butonu */}
                {liveVideos.length >= 2 && (
                  <button
                    onClick={() => onSelect(video)}
                    className="absolute bottom-14 right-3 text-[10px] px-2 py-1 rounded bg-black/60 text-gray-400 hover:text-white hover:bg-black/80 transition-colors backdrop-blur-sm z-10"
                  >
                    ▶ Tek İzle
                  </button>
                )}
              </div>
            );
          })}
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

  // Multi-view selection state (seç → toplu aç)
  const [multiSelectVideos, setMultiSelectVideos] = useState<Video[]>([]);

  // Auto Zap state
  const [autoZapActive, setAutoZapActive] = useState(false);
  const autoZapRef = useRef<NodeJS.Timeout | null>(null);

  // Autoplay next video state
  const [autoplayNext, setAutoplayNext] = useState(true); // default ON

  // TV Mode — auto-open on load
  const [tvBooted, setTvBooted] = useState(false);
  const [tvBootAnim, setTvBootAnim] = useState(true); // boot-up animation

  // Pre-roll ad state
  const [showPreroll, setShowPreroll] = useState(false);
  const [pendingVideo, setPendingVideo] = useState<Video | null>(null);

  // Mobile menu states
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileMultiChatOpen, setMobileMultiChatOpen] = useState(false);

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

  // Fetch real videos from YouTube API + poll every 3 minutes for live streams
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

    const fetchVideos = (showLoading = true) => {
      if (showLoading) setLoading(true);
      getMultiChannelVideos(channelYtIds, apiKey, 3)
        .then((result) => {
          setVideos(Array.isArray(result) ? result : []);
        })
        .catch(() => {
          setVideos([]);
        })
        .finally(() => { if (showLoading) setLoading(false); });
    };

    // Initial fetch
    fetchVideos(true);

    // Smart polling: gerçek yayın paternine göre kota dostu aralıklar
    // Server-side cache zaten koruma sağlıyor (canlı yoksa saatlerce cache)
    //
    // Türk futbol yayın paterni:
    // 02:00-10:00 → Kimse yayın yapmaz              → 2 saatte 1
    // 10:00-12:00 → Çok nadir, ara sıra erken yayın → 30 dk
    // 12:00-17:00 → Bazı kanallar başlar             → 15 dk
    // 17:00-20:00 → Yayınlar yoğunlaşır, maç öncesi → 5 dk
    // 20:00-02:00 → Pik saat, maçlar + post-maç     → 3 dk
    const getSmartInterval = () => {
      const hour = new Date().getHours();
      if (hour >= 2 && hour < 10) return 120 * 60 * 1000;  // 2 saat — ölü saat
      if (hour >= 10 && hour < 12) return 30 * 60 * 1000;   // 30 dk — nadir yayın
      if (hour >= 12 && hour < 17) return 15 * 60 * 1000;   // 15 dk — öğlen yayınları
      if (hour >= 17 && hour < 20) return 5 * 60 * 1000;    // 5 dk — maç öncesi
      return 3 * 60 * 1000;                                  // 3 dk — pik saat (20-02)
    };

    let pollTimer: ReturnType<typeof setTimeout>;
    const schedulePoll = () => {
      pollTimer = setTimeout(() => {
        fetchVideos(false);
        schedulePoll(); // Tekrar planla (her seferinde saati kontrol eder)
      }, getSmartInterval());
    };
    schedulePoll();

    return () => clearTimeout(pollTimer);
  }, [filteredChannels]);

  // TV MODE kapatıldı — kullanıcı kendi seçsin
  // Sayfa açılınca otomatik video açmıyoruz, anasayfa gösteriliyor
  useEffect(() => {
    if (!tvBooted && videos.length > 0) {
      setTvBooted(true);
      setTimeout(() => setTvBootAnim(false), 300);
    }
  }, [videos, tvBooted]);

  // Separate live, regular, and shorts videos
  const SHORTS_THRESHOLD = 90; // 90 saniyeden kısa = Shorts
  const liveVideos = useMemo(() => videos.filter((v) => v.live), [videos]);
  const regularVideos = useMemo(
    () => videos
      .filter((v) => !v.live && (!v.durationSeconds || v.durationSeconds >= SHORTS_THRESHOLD))
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()),
    [videos]
  );
  const shortsVideos = useMemo(
    () => videos
      .filter((v) => !v.live && v.durationSeconds && v.durationSeconds > 0 && v.durationSeconds < SHORTS_THRESHOLD)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()),
    [videos]
  );

  // All videos for zap navigation (shorts dahil)
  const allVideos = useMemo(() => [...liveVideos, ...regularVideos, ...shortsVideos], [liveVideos, regularVideos, shortsVideos]);

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

      // Enter: start multi-view with selected videos
      if (e.key === 'Enter' && multiSelectVideos.length > 0) {
        e.preventDefault();
        setMultiViewVideos(multiSelectVideos.slice(0, 8));
        setMultiViewAudioIndex(0);
        setActiveVideo(null);
        setMultiSelectVideos([]);
        return;
      }
      // Escape: clear multi-select
      if (e.key === 'Escape' && multiSelectVideos.length > 0) {
        e.preventDefault();
        setMultiSelectVideos([]);
        return;
      }

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
  }, [activeVideo, multiViewVideos, multiSelectVideos, handleZap, allVideos]);

  // Multi-view handlers
  const handleStartMultiView = useCallback((vids: Video[]) => {
    setMultiViewVideos(vids.slice(0, 8)); // Max 8
    setMultiViewAudioIndex(0);
    setActiveVideo(null);
  }, []);

  // Toggle video selection for multi-view (seç/kaldır)
  const handleMultiSelectToggle = useCallback(
    (video: Video) => {
      setMultiSelectVideos((prev) => {
        const exists = prev.find((v) => v.id === video.id);
        if (exists) return prev.filter((v) => v.id !== video.id);
        if (prev.length >= 8) return prev; // Max 8
        return [...prev, video];
      });
    },
    []
  );

  // Start multi-view with selected videos
  const handleMultiSelectStart = useCallback(() => {
    if (multiSelectVideos.length === 0) return;
    setMultiViewVideos(multiSelectVideos.slice(0, 8));
    setMultiViewAudioIndex(0);
    setActiveVideo(null);
    setMultiSelectVideos([]); // Clear selection
  }, [multiSelectVideos]);

  // Legacy: add single video directly to running multi-view
  const handleMultiViewAdd = useCallback(
    (video: Video) => {
      if (multiViewVideos.length >= 8) return;
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
        onVideoEnd={() => handleZap('next')}
        autoplayNext={autoplayNext}
        onAutoplayNextToggle={() => setAutoplayNext(!autoplayNext)}
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

      {/* Multi-Select Floating Bar */}
      {multiSelectVideos.length > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] animate-slide-up max-w-[90vw] px-2">
          <div className="bg-[#1a1a2e]/95 backdrop-blur-lg border border-emerald-500/30 rounded-2xl px-4 py-3 shadow-2xl shadow-emerald-500/10 flex items-center gap-3 overflow-x-auto">
            {/* Selected thumbnails */}
            <div className="flex -space-x-2">
              {multiSelectVideos.map((v, i) => (
                <div key={v.id} className="w-8 h-8 rounded-full border-2 border-emerald-500 overflow-hidden relative">
                  {v.thumbnail ? (
                    <img src={v.thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-700 flex items-center justify-center text-[10px]">{i + 1}</div>
                  )}
                </div>
              ))}
              {/* Empty slots (show max 2 extras) */}
              {multiSelectVideos.length < 8 && Array.from({ length: Math.min(2, 8 - multiSelectVideos.length) }).map((_, i) => (
                <div key={`empty-${i}`} className="w-8 h-8 rounded-full border-2 border-dashed border-gray-600 bg-gray-800/50 flex items-center justify-center">
                  <span className="text-[10px] text-gray-600">+</span>
                </div>
              ))}
            </div>

            {/* Count + Start button */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{multiSelectVideos.length}/8</span>
              <button
                onClick={handleMultiSelectStart}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs px-4 py-2 rounded-xl transition-colors"
              >
                📺 Çoklu İzle
              </button>
              <button
                onClick={() => setMultiSelectVideos([])}
                className="text-gray-500 hover:text-white text-xs px-2 py-2 transition-colors"
                title="Seçimi temizle"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

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
            <nav className="hidden md:flex items-center gap-1 ml-2">
              <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400">
                📺 Ana Sayfa
              </span>
              <Link href="/app/matches" className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
                ⚽ Maçlar
              </Link>
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
              <Link href="/app/admin" className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/5 hover:text-red-400 transition-colors">
                ⚙ Admin
              </Link>
            </nav>
            {/* Mobile hamburger button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <span className="text-lg">{mobileMenuOpen ? '✕' : '☰'}</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            {liveVideos.length > 0 && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-500 live-pulse"></span>
                {liveVideos.length} Canlı
              </span>
            )}
            {(selectedTeam || selectedContentType) && (
              <button onClick={handleReset} className="hidden sm:block text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-gray-400">
                Sıfırla
              </button>
            )}
            <ProfileMenu user={user} />
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="md:hidden animate-menu-fade border-t border-white/5" style={{ background: 'rgba(15,23,36,0.95)' }}>
            <nav className="flex flex-col px-4 py-3 space-y-2">
              <Link href="/app" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg text-sm font-medium bg-emerald-500/15 text-emerald-400 transition-colors">
                📺 Ana Sayfa
              </Link>
              <Link href="/app/matches" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
                ⚽ Maçlar
              </Link>
              <Link href="/app/chat" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
                💬 Sohbet
              </Link>
              <Link href="/app/twitter" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
                🐦 Twitter
              </Link>
              <Link href="/app/channels" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
                📡 Kanallar
              </Link>
              <Link href="/app/stats" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
                📊 Reyting
              </Link>
              <Link href="/app/admin" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-red-400 transition-colors">
                ⚙ Admin
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* MAIN CONTENT WITH SIDEBAR */}
      <div className="max-w-7xl mx-auto px-4 mt-6 flex gap-6">
        {/* Left: Main Content (Full width on mobile) */}
        <div className="flex-1 min-w-0 pb-20 md:pb-0">
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
                    {/* Multi-view select button */}
                    <div className="px-3 pb-2 flex justify-end">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMultiSelectToggle(video); }}
                        className={`text-[10px] px-2 py-1 rounded transition-colors ${
                          multiSelectVideos.find((v) => v.id === video.id)
                            ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50'
                            : 'bg-white/5 text-gray-500 hover:bg-emerald-500/10 hover:text-emerald-400'
                        }`}
                        title="Çoklu izlemeye ekle/çıkar"
                      >
                        {multiSelectVideos.find((v) => v.id === video.id)
                          ? `✓ Seçildi (${multiSelectVideos.findIndex((v) => v.id === video.id) + 1})`
                          : '+ Çoklu İzle'}
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

          {/* SHORTS SECTION — kısa videolar */}
          {shortsVideos.length > 0 && (
            <section className="mt-6 animate-slide-up">
              <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded">SHORTS</span>
                Kısa Videolar
                <span className="text-xs text-gray-600">({shortsVideos.length})</span>
              </h3>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollSnapType: 'x mandatory' }}>
                {shortsVideos.map((video) => (
                  <button
                    key={video.id}
                    onClick={() => setActiveVideo(video)}
                    className="flex-shrink-0 w-36 group text-left"
                    style={{ scrollSnapAlign: 'start' }}
                  >
                    <div className="relative aspect-[9/16] rounded-xl overflow-hidden bg-gray-800 mb-1.5">
                      {video.thumbnail ? (
                        <img src={video.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                        {video.duration}
                      </div>
                      <div className="absolute top-1.5 left-1.5 bg-red-500/90 text-white text-[9px] px-1 py-0.5 rounded font-bold">
                        SHORTS
                      </div>
                    </div>
                    <p className="text-xs text-gray-300 font-medium line-clamp-2 group-hover:text-white transition-colors leading-tight">
                      {video.title}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-0.5 truncate">{video.channelTitle}</p>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right: Sidebar (hidden on mobile) */}
        <div className="hidden lg:block w-96 shrink-0">
          <div className="sticky top-20 space-y-4">
            <SponsorSidebar />
            <ChatPanel />
            <TwitterFeedWidget />
            <LiveScoreWidget />
            <FixturesWidget />
            <StandingsWidget />
            <UserProfileWidget />
            <PollWidget />
          </div>
        </div>
      </div>

      {/* Mobile Sidebar FAB + Drawer (visible only on mobile/tablet) */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setMobileSidebarOpen(false)}>
          <div className="fixed bottom-0 left-0 right-0 z-50 animate-drawer-up max-h-[80vh] flex flex-col rounded-t-2xl border-t border-white/10" style={{ background: 'rgba(17,24,39,0.98)' }}>
            {/* Drawer Handle */}
            <div className="flex justify-center pt-3 pb-2 shrink-0">
              <div className="w-12 h-1 rounded-full bg-white/30"></div>
            </div>

            {/* Drawer Header */}
            <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold text-white">⚽ Bilgiler & Sohbet</h3>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* Drawer Content - Scrollable */}
            <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
              <SponsorSidebar />
              <ChatPanel />
              <TwitterFeedWidget />
              <LiveScoreWidget />
              <FixturesWidget />
              <StandingsWidget />
              <UserProfileWidget />
              <PollWidget />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sidebar FAB Button */}
      <button
        onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        className="fixed bottom-20 right-4 z-40 lg:hidden w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xl transition-all active:scale-95 shadow-lg"
        title="Bilgileri aç/kapat"
      >
        ⚽
      </button>

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
