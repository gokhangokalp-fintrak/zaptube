'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import channelData from '@/data/channels.json';
import { ChannelData, ChannelStats, UserChannelPreference } from '@/types';
import { formatViewCount } from '@/lib/youtube';
import { getUserPreferences, toggleFollow, toggleFavorite } from '@/lib/supabase-db';
import { createClient } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { GuestReminderBanner } from '@/components/GuestPrompt';

const data = channelData as ChannelData;

export default function ChannelsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [prefs, setPrefs] = useState<UserChannelPreference[]>([]);
  const [stats, setStats] = useState<ChannelStats[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Get user with auth state listener
  useEffect(() => {
    const supabase = createClient();
    // First try getUser
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
    // Also listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load preferences
  useEffect(() => {
    if (!user) return;
    getUserPreferences(user.id).then(setPrefs);
  }, [user]);

  // Load YouTube channel stats
  useEffect(() => {
    const ytIds = data.channels.map((ch) => ch.youtubeChannelId).join(',');
    fetch(`/api/channel-stats?channelIds=${ytIds}`)
      .then((r) => r.json())
      .then((d) => setStats(d.stats || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Filter channels
  const filteredChannels = useMemo(() => {
    return data.channels.filter((ch) => {
      const teamMatch = !selectedTeam || selectedTeam === 'genel' || ch.teams.includes(selectedTeam) || ch.teams.includes('genel');
      const searchMatch = !search || ch.name.toLowerCase().includes(search.toLowerCase()) || ch.description.toLowerCase().includes(search.toLowerCase());
      return teamMatch && searchMatch;
    });
  }, [selectedTeam, search]);

  // Preference helpers
  const isFollowing = (channelId: string) => prefs.find((p) => p.channel_id === channelId)?.is_following || false;
  const isFavorite = (channelId: string) => prefs.find((p) => p.channel_id === channelId)?.is_favorite || false;
  const followCount = prefs.filter((p) => p.is_following).length;
  const favoriteCount = prefs.filter((p) => p.is_favorite).length;
  const getStats = (ytId: string) => stats.find((s) => s.channelId === ytId);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const [showGuestToast, setShowGuestToast] = useState(false);
  const [guestToastMsg, setGuestToastMsg] = useState('');

  const handleGuestBlock = (msg: string) => {
    setGuestToastMsg(msg);
    setShowGuestToast(true);
  };

  const handleFollow = async (channelId: string) => {
    if (!user) {
      handleGuestBlock('Kanalı takip etmek için ücretsiz üye ol');
      return;
    }
    setActionLoading(channelId + '-follow');
    try {
      const result = await toggleFollow(user.id, channelId);
      if (result.success) {
        const updated = await getUserPreferences(user.id);
        setPrefs(updated);
        showToast(result.isFollowing ? '✓ Takip edildi!' : 'Takip bırakıldı');
      } else if (result.error) {
        showToast(result.error);
      }
    } catch (err: any) {
      showToast('Hata: ' + (err?.message || 'Bir sorun oluştu'));
    }
    setActionLoading(null);
  };

  const handleFavorite = async (channelId: string) => {
    if (!user) {
      handleGuestBlock('Favorilere eklemek için ücretsiz üye ol');
      return;
    }
    setActionLoading(channelId + '-fav');
    try {
      const result = await toggleFavorite(user.id, channelId);
      if (result.success) {
        const updated = await getUserPreferences(user.id);
        setPrefs(updated);
        showToast(result.isFavorite ? '★ Favorilere eklendi!' : 'Favorilerden çıkarıldı');
      } else if (result.error) {
        showToast(result.error);
      }
    } catch (err: any) {
      showToast('Hata: ' + (err?.message || 'Bir sorun oluştu'));
    }
    setActionLoading(null);
  };

  return (
    <main className="min-h-screen">
      {/* Misafir hatırlatma */}
      {!user && <GuestReminderBanner />}

      {/* Misafir aksiyon engeli toast */}
      {showGuestToast && (
        <div className="fixed top-4 right-4 z-[200] bg-orange-500/90 backdrop-blur-sm text-white text-sm px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-slide-down max-w-sm">
          <span>{guestToastMsg}</span>
          <button
            onClick={async () => {
              const supabase = createClient();
              await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: `${window.location.origin}/auth/callback` },
              });
            }}
            className="shrink-0 px-2.5 py-1 bg-white text-gray-900 text-xs font-bold rounded-lg hover:bg-gray-100 transition-all"
          >
            Üye Ol
          </button>
          <button onClick={() => setShowGuestToast(false)} className="text-white/60 hover:text-white shrink-0">✕</button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[200] text-white text-sm px-4 py-2.5 rounded-xl shadow-xl ${toast.startsWith('✓') || toast.startsWith('★') ? 'bg-emerald-500/90' : toast.startsWith('Hata') ? 'bg-red-500/90' : 'bg-orange-500/90'}`}>
          {toast}
        </div>
      )}

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
              <Link href="/app/chat" className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
                💬 Sohbet
              </Link>
              <Link href="/app/twitter" className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
                🐦 Twitter
              </Link>
              <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400">
                📡 Kanallar
              </span>
              <Link href="/app/stats" className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
                📊 Reyting
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 mt-6 flex gap-6">
        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Page title */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-1">
              <span className="bg-gradient-to-r from-red-500 to-emerald-400 bg-clip-text text-transparent">Kanallar</span>
            </h2>
            <p className="text-sm text-gray-500">Takip et, favorilere ekle, hepsini bir arada izle</p>
          </div>

          {/* Search + Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <input
              type="text"
              placeholder="Kanal ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-[#1e293b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-emerald-500/40 transition-colors"
            />
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
          </div>

          {/* Channel Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-[#1e293b] rounded-xl p-4 animate-pulse">
                  <div className="flex gap-3">
                    <div className="w-14 h-14 rounded-xl bg-gray-700" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-700 rounded w-1/2" />
                      <div className="h-3 bg-gray-700 rounded w-3/4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger">
              {filteredChannels.map((ch) => {
                const chStats = getStats(ch.youtubeChannelId);
                const following = isFollowing(ch.id);
                const fav = isFavorite(ch.id);

                return (
                  <div
                    key={ch.id}
                    className={`bg-[#1e293b] rounded-xl p-4 border transition-all hover:scale-[1.01] ${
                      fav
                        ? 'border-yellow-500/30 shadow-lg shadow-yellow-500/5'
                        : following
                        ? 'border-emerald-500/20'
                        : 'border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex gap-3 mb-3">
                      {/* Channel avatar */}
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-xl font-bold shrink-0 overflow-hidden">
                        {chStats?.thumbnail ? (
                          <img src={chStats.thumbnail} alt={ch.name} className="w-full h-full object-cover" />
                        ) : (
                          ch.name[0]
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white truncate">{ch.name}</h3>
                          {fav && <span className="text-yellow-400 text-xs">★</span>}
                        </div>
                        <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">{ch.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {ch.teams.map((t) => (
                            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">
                              {data.teams.find((team) => team.id === t)?.emoji}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Stats row */}
                    {chStats && (
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="bg-white/5 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-gray-500">Abone</p>
                          <p className="text-xs font-bold text-white">{formatViewCount(chStats.subscriberCount)}</p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-gray-500">İzlenme</p>
                          <p className="text-xs font-bold text-white">{formatViewCount(chStats.viewCount)}</p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-gray-500">Video</p>
                          <p className="text-xs font-bold text-white">{formatViewCount(chStats.videoCount)}</p>
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleFollow(ch.id)}
                        disabled={actionLoading === ch.id + '-follow'}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                          following
                            ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {actionLoading === ch.id + '-follow' ? (
                          <span className="animate-spin">↻</span>
                        ) : following ? (
                          <>✓ Takip Ediliyor</>
                        ) : (
                          <>+ Takip Et</>
                        )}
                      </button>
                      <button
                        onClick={() => handleFavorite(ch.id)}
                        disabled={actionLoading === ch.id + '-fav'}
                        className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                          fav
                            ? 'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30 hover:bg-yellow-500/25'
                            : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-yellow-400'
                        }`}
                      >
                        {actionLoading === ch.id + '-fav' ? (
                          <span className="animate-spin">↻</span>
                        ) : fav ? (
                          <>★ Favori</>
                        ) : (
                          <>☆ Favori</>
                        )}
                      </button>
                    </div>

                    {/* YouTube'da Takip Et */}
                    <a
                      href={`https://www.youtube.com/channel/${ch.youtubeChannelId}?sub_confirmation=1`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 mt-2 px-3 py-2 rounded-lg text-xs font-bold bg-red-600/15 text-red-400 ring-1 ring-red-500/20 hover:bg-red-600/25 hover:text-red-300 transition-all"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                      YouTube'da Abone Ol
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="hidden lg:block w-72 shrink-0">
          <div className="sticky top-20 space-y-4">
            {/* Takip Listem */}
            <div className="bg-[#1e293b] rounded-xl border border-emerald-500/20 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Takip Listem</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                  {followCount}/20
                </span>
              </div>
              <div className="p-3 space-y-1.5 max-h-48 overflow-y-auto">
                {prefs.filter((p) => p.is_following).length === 0 ? (
                  <p className="text-[11px] text-gray-600 text-center py-2">Henüz kanal takip etmiyorsun</p>
                ) : (
                  prefs
                    .filter((p) => p.is_following)
                    .map((p) => {
                      const ch = data.channels.find((c) => c.id === p.channel_id);
                      if (!ch) return null;
                      return (
                        <div key={p.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-xs font-bold shrink-0">
                            {ch.name[0]}
                          </div>
                          <span className="text-[11px] text-white truncate">{ch.name}</span>
                          {p.is_favorite && <span className="text-yellow-400 text-[10px] ml-auto shrink-0">★</span>}
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            {/* Favorilerim */}
            <div className="bg-[#1e293b] rounded-xl border border-yellow-500/20 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-xs font-bold text-yellow-400 uppercase tracking-wider">Favorilerim</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-bold">
                  {favoriteCount}/5
                </span>
              </div>
              <div className="p-3 space-y-1.5">
                {prefs.filter((p) => p.is_favorite).length === 0 ? (
                  <p className="text-[11px] text-gray-600 text-center py-2">Henüz favori kanal yok</p>
                ) : (
                  prefs
                    .filter((p) => p.is_favorite)
                    .map((p) => {
                      const ch = data.channels.find((c) => c.id === p.channel_id);
                      if (!ch) return null;
                      return (
                        <div key={p.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-xs font-bold shrink-0">
                            {ch.name[0]}
                          </div>
                          <span className="text-[11px] text-white truncate">{ch.name}</span>
                          <span className="text-yellow-400 text-[10px] ml-auto shrink-0">★</span>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
