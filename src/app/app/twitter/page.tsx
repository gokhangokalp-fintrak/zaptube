'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import AdBanner from '@/components/ads/AdBanner';

interface Tweet {
  id: string;
  text: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  createdAt: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  quoteCount: number;
}

interface SuggestedAccount {
  id: string;
  twitter_handle: string;
  display_name: string;
  category: string;
  team: string | null;
  avatar_emoji: string;
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}sn`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}dk`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}sa`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}g`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function parseLinksInText(text: string): (string | JSX.Element)[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;

  const matches: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = urlRegex.exec(text)) !== null) {
    matches.push(m);
  }

  matches.forEach((match) => {
    if (match.index! > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    parts.push(
      <a
        key={`link-${match.index}`}
        href={match[0]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#1DA1F2] hover:underline"
      >
        {match[0]}
      </a>
    );
    lastIndex = match.index! + match[0].length;
  });

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

function TweetCard({ tweet }: { tweet: Tweet }) {
  const avatarInitials = getInitials(tweet.authorName);
  const bgGradient = `hsl(${avatarInitials.charCodeAt(0) * 7 % 360}, 70%, 50%)`;

  return (
    <div className="border border-white/5 rounded-lg p-4 bg-[#1e293b] hover:bg-[#1e293b]/80 transition-colors">
      <div className="flex gap-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          style={{ backgroundColor: bgGradient }}
        >
          {tweet.authorAvatar ? (
            <img
              src={tweet.authorAvatar}
              alt={tweet.authorName}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            avatarInitials
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-bold text-white text-sm">{tweet.authorName}</span>
            <span className="text-gray-400 text-sm">@{tweet.authorHandle}</span>
            <span className="text-gray-500 text-xs">
              {formatRelativeTime(tweet.createdAt)}
            </span>
          </div>

          <p className="text-gray-100 text-sm leading-relaxed break-words mb-3">
            {parseLinksInText(tweet.text)}
          </p>

          <div className="flex gap-6 text-gray-400 text-xs">
            <div className="flex items-center gap-1 hover:text-[#1DA1F2] cursor-pointer transition-colors">
              <span>💬</span>
              <span>{tweet.replyCount}</span>
            </div>
            <div className="flex items-center gap-1 hover:text-[#1DA1F2] cursor-pointer transition-colors">
              <span>🔄</span>
              <span>{tweet.retweetCount}</span>
            </div>
            <div className="flex items-center gap-1 hover:text-[#1DA1F2] cursor-pointer transition-colors">
              <span>❤️</span>
              <span>{tweet.likeCount}</span>
            </div>
            <div className="flex items-center gap-1 hover:text-[#1DA1F2] cursor-pointer transition-colors">
              <span>📤</span>
              <span>{tweet.quoteCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TweetCardSkeleton() {
  return (
    <div className="border border-white/5 rounded-lg p-4 bg-[#1e293b] animate-pulse">
      <div className="flex gap-3">
        <div className="w-12 h-12 rounded-full bg-gray-700 flex-shrink-0" />
        <div className="flex-1">
          <div className="h-4 bg-gray-700 rounded w-32 mb-2" />
          <div className="h-3 bg-gray-700 rounded w-full mb-2" />
          <div className="h-3 bg-gray-700 rounded w-5/6 mb-3" />
          <div className="flex gap-6">
            <div className="h-3 bg-gray-700 rounded w-8" />
            <div className="h-3 bg-gray-700 rounded w-8" />
            <div className="h-3 bg-gray-700 rounded w-8" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TwitterPage() {
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [followedHandles, setFollowedHandles] = useState<string[]>([]);
  const [suggestedAccounts, setSuggestedAccounts] = useState<SuggestedAccount[]>([]);
  const [newHandle, setNewHandle] = useState('');
  const [addingHandle, setAddingHandle] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [feedMode, setFeedMode] = useState<'all' | 'selected'>('all');
  const [selectedHandles, setSelectedHandles] = useState<Set<string>>(new Set());

  // Fetch tweets
  const fetchTweets = useCallback(async (handles: string[]) => {
    if (handles.length === 0) {
      setTweets([]);
      setLoading(false);
      return;
    }

    try {
      setRefreshing(true);
      const response = await fetch(
        `/api/twitter/timeline?handles=${handles.join(',')}`
      );

      if (!response.ok) {
        if (response.status === 500) {
          setError(
            'Twitter API henüz yapılandırılmadı. TWITTER_BEARER_TOKEN environment variable\'ı ekleyin.'
          );
        } else {
          setError('Tweet yükleme hatası');
        }
        setTweets([]);
        return;
      }

      const data = await response.json();
      setTweets(data.tweets || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching tweets:', err);
      setError(
        'Twitter API henüz yapılandırılmadı. TWITTER_BEARER_TOKEN environment variable\'ı ekleyin.'
      );
      setTweets([]);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  // Fetch followed handles
  const fetchFollowedHandles = useCallback(async (uid: string) => {
    try {
      const supabase = createClient();
      const { data, error: dbError } = await supabase
        .from('user_twitter_follows')
        .select('twitter_handle')
        .eq('user_id', uid);

      if (dbError) throw dbError;

      const handles = data?.map((row) => row.twitter_handle) || [];
      setFollowedHandles(handles);
      await fetchTweets(handles);
    } catch (err) {
      console.error('Error fetching followed handles:', err);
      setError('Takip edilen hesaplar yüklenemedi');
    }
  }, [fetchTweets]);

  // Fetch suggested accounts
  const fetchSuggestedAccounts = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error: dbError } = await supabase
        .from('twitter_suggested_accounts')
        .select('*');

      if (dbError) throw dbError;

      setSuggestedAccounts(data || []);
    } catch (err) {
      console.error('Error fetching suggested accounts:', err);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setError('Giriş yapınız');
          setLoading(false);
          return;
        }

        setUserId(user.id);
        await fetchFollowedHandles(user.id);
        await fetchSuggestedAccounts();
      } catch (err) {
        console.error('Initialization error:', err);
        setError('Sayfa yüklenemedi');
        setLoading(false);
      }
    };

    initialize();
  }, [fetchFollowedHandles, fetchSuggestedAccounts]);

  // Get active handles based on feed mode
  const getActiveHandles = useCallback(() => {
    if (feedMode === 'all') return followedHandles;
    return followedHandles.filter((h) => selectedHandles.has(h));
  }, [feedMode, followedHandles, selectedHandles]);

  // Re-fetch when feed mode or selection changes
  useEffect(() => {
    if (followedHandles.length === 0) return;
    const active = feedMode === 'all' ? followedHandles : followedHandles.filter((h) => selectedHandles.has(h));
    if (active.length > 0) {
      fetchTweets(active);
    } else {
      setTweets([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedMode, selectedHandles]);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    if (followedHandles.length === 0) return;

    const interval = setInterval(() => {
      const active = feedMode === 'all' ? followedHandles : followedHandles.filter((h) => selectedHandles.has(h));
      if (active.length > 0) fetchTweets(active);
    }, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, [followedHandles, feedMode, selectedHandles, fetchTweets]);

  // Add handle
  const handleAddHandle = async () => {
    if (!newHandle.trim() || !userId) return;

    const handle = newHandle.startsWith('@')
      ? newHandle.substring(1)
      : newHandle;

    if (!handle.trim()) return;

    try {
      setAddingHandle(true);
      const supabase = createClient();

      // Check if already following
      if (followedHandles.includes(handle)) {
        setNewHandle('');
        return;
      }

      const { error: insertError } = await supabase
        .from('user_twitter_follows')
        .insert({
          user_id: userId,
          twitter_handle: handle,
        });

      if (insertError) throw insertError;

      setFollowedHandles([...followedHandles, handle]);
      setNewHandle('');
      await fetchTweets([...followedHandles, handle]);
    } catch (err) {
      console.error('Error adding handle:', err);
      setError('Hesap eklenemedi');
    } finally {
      setAddingHandle(false);
    }
  };

  // Remove handle
  const handleRemoveHandle = async (handle: string) => {
    if (!userId) return;

    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from('user_twitter_follows')
        .delete()
        .eq('user_id', userId)
        .eq('twitter_handle', handle);

      if (deleteError) throw deleteError;

      const updated = followedHandles.filter((h) => h !== handle);
      setFollowedHandles(updated);
      await fetchTweets(updated);
    } catch (err) {
      console.error('Error removing handle:', err);
      setError('Hesap kaldırılamadı');
    }
  };

  // Toggle handle selection
  const toggleHandleSelection = (handle: string) => {
    setSelectedHandles((prev) => {
      const next = new Set(prev);
      if (next.has(handle)) {
        next.delete(handle);
      } else {
        next.add(handle);
      }
      return next;
    });
  };

  // Add suggested account
  const handleAddSuggestedAccount = async (handle: string) => {
    if (!userId) return;

    try {
      setAddingHandle(true);
      const supabase = createClient();

      if (followedHandles.includes(handle)) {
        setAddingHandle(false);
        return;
      }

      const { error: insertError } = await supabase
        .from('user_twitter_follows')
        .insert({
          user_id: userId,
          twitter_handle: handle,
        });

      if (insertError) throw insertError;

      const updated = [...followedHandles, handle];
      setFollowedHandles(updated);
      await fetchTweets(updated);
    } catch (err) {
      console.error('Error adding suggested account:', err);
      setError('Hesap eklenemedi');
    } finally {
      setAddingHandle(false);
    }
  };

  // Group suggested accounts by category
  const groupedSuggestions = suggestedAccounts.reduce(
    (acc, account) => {
      if (!acc[account.category]) {
        acc[account.category] = [];
      }
      acc[account.category].push(account);
      return acc;
    },
    {} as Record<string, SuggestedAccount[]>
  );

  const categoryEmojis: Record<string, string> = {
    'Yorumcular': '🎙️',
    'Kulüpler': '⚽',
    'Medya': '📰',
  };

  return (
    <div className="min-h-screen bg-[#111827]">
      {/* Navigation Header */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#111827]/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/app" className="text-xl font-bold text-[#1DA1F2]">
              📺 ZapTube
            </Link>
            <div className="flex gap-6 text-sm">
              <Link
                href="/app"
                className="text-gray-400 hover:text-white transition-colors"
              >
                📺 Ana Sayfa
              </Link>
              <Link
                href="/app/chat"
                className="text-gray-400 hover:text-white transition-colors"
              >
                💬 Sohbet
              </Link>
              <span className="text-white font-semibold">🐦 Twitter</span>
              <Link
                href="/app/channels"
                className="text-gray-400 hover:text-white transition-colors"
              >
                📡 Kanallar
              </Link>
              <Link
                href="/app/stats"
                className="text-gray-400 hover:text-white transition-colors"
              >
                📊 Reyting
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span>👤 Kullanıcı Profili</span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-3 gap-6 lg:grid-cols-1">
        {/* Left Column - Tweet Feed */}
        <div className="lg:col-span-1 col-span-2 space-y-4">
          {/* Feed Mode Toggle + Refresh */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex bg-[#1e293b] rounded-lg border border-white/10 overflow-hidden">
              <button
                onClick={() => setFeedMode('all')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  feedMode === 'all'
                    ? 'bg-[#1DA1F2] text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Tümü ({followedHandles.length})
              </button>
              <button
                onClick={() => setFeedMode('selected')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  feedMode === 'selected'
                    ? 'bg-[#1DA1F2] text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Seçililer ({selectedHandles.size})
              </button>
            </div>
            <button
              onClick={() => fetchTweets(getActiveHandles())}
              disabled={refreshing || followedHandles.length === 0}
              className="px-4 py-2 bg-[#1DA1F2] text-white rounded-lg font-medium hover:bg-[#1a8cd8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm"
            >
              {refreshing ? (
                <>
                  <span className="inline-block animate-spin">🔄</span>
                  Yenileniyor...
                </>
              ) : (
                <>🔄 Yenile</>
              )}
            </button>
          </div>

          {/* Selected mode info */}
          {feedMode === 'selected' && selectedHandles.size === 0 && followedHandles.length > 0 && (
            <div className="border border-yellow-500/30 rounded-lg p-3 bg-yellow-500/10">
              <p className="text-yellow-400 text-sm">
                Sağ panelden tweet görmek istediğiniz hesapları seçin.
              </p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="border border-red-500/30 rounded-lg p-4 bg-red-500/10">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && followedHandles.length === 0 && !error && (
            <div className="border border-white/5 rounded-lg p-8 bg-[#1e293b] text-center">
              <p className="text-gray-400">
                Henüz hesap eklemediniz. Sağdaki panelden hesap ekleyin!
              </p>
            </div>
          )}

          {/* Loading Skeletons */}
          {loading && (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <TweetCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Tweet Feed */}
          <div className="space-y-4">
            {tweets.map((tweet) => (
              <TweetCard key={tweet.id} tweet={tweet} />
            ))}
          </div>

          {/* Empty Feed State */}
          {!loading && followedHandles.length > 0 && tweets.length === 0 && !error && (
            <div className="border border-white/5 rounded-lg p-8 bg-[#1e293b] text-center">
              <p className="text-gray-400">Tweet bulunamadı</p>
            </div>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <div className="col-span-1 space-y-6">
          {/* Followed Accounts Section */}
          <div className="border border-white/5 rounded-lg p-4 bg-[#1e293b]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white">🐦 Takip Ettiğim Hesaplar</h3>
              {feedMode === 'selected' && followedHandles.length > 0 && (
                <button
                  onClick={() => {
                    if (selectedHandles.size === followedHandles.length) {
                      setSelectedHandles(new Set());
                    } else {
                      setSelectedHandles(new Set(followedHandles));
                    }
                  }}
                  className="text-xs text-[#1DA1F2] hover:underline"
                >
                  {selectedHandles.size === followedHandles.length ? 'Hiçbirini Seçme' : 'Tümünü Seç'}
                </button>
              )}
            </div>
            {followedHandles.length === 0 ? (
              <p className="text-gray-400 text-sm">Henüz hesap eklemediniz</p>
            ) : (
              <div className="space-y-2">
                {followedHandles.map((handle) => {
                  const isSelected = selectedHandles.has(handle);
                  return (
                    <div
                      key={handle}
                      className={`flex items-center justify-between p-2 rounded transition-colors ${
                        feedMode === 'selected' && isSelected
                          ? 'bg-[#1DA1F2]/10 border border-[#1DA1F2]/30'
                          : 'bg-black/20 hover:bg-black/40 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {feedMode === 'selected' && (
                          <button
                            onClick={() => toggleHandleSelection(handle)}
                            className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-[#1DA1F2] border-[#1DA1F2] text-white'
                                : 'border-gray-500 hover:border-[#1DA1F2]'
                            }`}
                          >
                            {isSelected && <span className="text-xs">✓</span>}
                          </button>
                        )}
                        <span className="text-gray-300 text-sm truncate">🐦 @{handle}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveHandle(handle)}
                        className="text-gray-400 hover:text-red-400 transition-colors font-bold flex-shrink-0 ml-2"
                        title="Kaldır"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add Account Section */}
          <div className="border border-white/5 rounded-lg p-4 bg-[#1e293b]">
            <h3 className="font-bold text-white mb-4">➕ Hesap Ekle</h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="@kullaniciadi"
                value={newHandle}
                onChange={(e) => setNewHandle(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddHandle()}
                disabled={addingHandle}
                className="flex-1 px-3 py-2 bg-black/20 border border-white/10 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#1DA1F2] disabled:opacity-50"
              />
              <button
                onClick={handleAddHandle}
                disabled={addingHandle || !newHandle.trim()}
                className="px-3 py-2 bg-[#1DA1F2] text-white rounded font-medium hover:bg-[#1a8cd8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {addingHandle ? '...' : 'Ekle'}
              </button>
            </div>
          </div>

          {/* Suggested Accounts Section */}
          {Object.keys(groupedSuggestions).length > 0 && (
            <div className="border border-white/5 rounded-lg p-4 bg-[#1e293b]">
              <h3 className="font-bold text-white mb-4">⭐ Önerilen Hesaplar</h3>
              <div className="space-y-4">
                {Object.entries(groupedSuggestions).map(
                  ([category, accounts]) => (
                    <div key={category}>
                      <h4 className="text-xs font-semibold text-gray-400 mb-2">
                        {categoryEmojis[category] || '📌'} {category}
                      </h4>
                      <div className="space-y-2">
                        {accounts.map((account) => {
                          const isFollowing = followedHandles.includes(
                            account.twitter_handle
                          );
                          return (
                            <div
                              key={account.id}
                              className="flex items-center justify-between p-2 rounded bg-black/20 hover:bg-black/40 transition-colors"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-lg">{account.avatar_emoji}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-gray-300 text-xs font-medium truncate">
                                    {account.display_name}
                                  </p>
                                  <p className="text-gray-500 text-xs truncate">
                                    @{account.twitter_handle}
                                  </p>
                                </div>
                              </div>
                              {isFollowing ? (
                                <span className="text-green-400 text-lg">✓</span>
                              ) : (
                                <button
                                  onClick={() =>
                                    handleAddSuggestedAccount(
                                      account.twitter_handle
                                    )
                                  }
                                  disabled={addingHandle}
                                  className="px-2 py-1 bg-[#1DA1F2] text-white rounded text-xs font-medium hover:bg-[#1a8cd8] disabled:opacity-50 transition-colors"
                                >
                                  Ekle
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* Ad Banner */}
          <AdBanner slot="sidebar" />
        </div>
      </div>
    </div>
  );
}
