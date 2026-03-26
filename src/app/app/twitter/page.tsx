'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { Tweet } from 'react-tweet';
import AdBanner from '@/components/ads/AdBanner';

// Türk futbol Twitter hesapları
const FOOTBALL_ACCOUNTS = [
  { handle: 'GalatasaraySK', name: 'Galatasaray', team: 'galatasaray', category: 'club', emoji: '🟡🔴' },
  { handle: 'Fenerbahce', name: 'Fenerbahçe', team: 'fenerbahce', category: 'club', emoji: '💛💙' },
  { handle: 'Besiktas', name: 'Beşiktaş', team: 'besiktas', category: 'club', emoji: '⚫⚪' },
  { handle: 'Trabzonspor', name: 'Trabzonspor', team: 'trabzonspor', category: 'club', emoji: '🔵🟤' },
  { handle: 'futbolarena', name: 'FutbolArena', team: 'genel', category: 'media', emoji: '📰' },
  { handle: 'sporarena', name: 'Spor Arena', team: 'genel', category: 'media', emoji: '📰' },
  { handle: 'ASpor', name: 'A Spor', team: 'genel', category: 'media', emoji: '📺' },
  { handle: 'NTVSpor', name: 'NTV Spor', team: 'genel', category: 'media', emoji: '📺' },
  { handle: 'yagosabuncuoglu', name: 'Yağız Sabuncuoğlu', team: 'genel', category: 'journalist', emoji: '🎤' },
  { handle: 'ercantofficial', name: 'Ercan Taner', team: 'genel', category: 'journalist', emoji: '🎤' },
  { handle: 'aliececom', name: 'Ali Ece', team: 'genel', category: 'journalist', emoji: '🎤' },
  { handle: 'Sinamekiserdar', name: 'Serdar Ali Çelikler', team: 'genel', category: 'journalist', emoji: '🎤' },
  { handle: 'nevzatdindar', name: 'Nevzat Dindar', team: 'galatasaray', category: 'journalist', emoji: '🟡🔴🎤' },
  { handle: 'emrekbol', name: 'Emre Bol', team: 'genel', category: 'journalist', emoji: '🎤' },
  { handle: 'fatihaltayli', name: 'Fatih Altaylı', team: 'genel', category: 'journalist', emoji: '🎤' },
  { handle: 'nexustransfer', name: 'Nexus Transfer', team: 'genel', category: 'transfer', emoji: '🔄' },
  { handle: 'Transferhaber6', name: 'Transfer Haberleri', team: 'genel', category: 'transfer', emoji: '🔄' },
  { handle: 'TFF_Org', name: 'TFF', team: 'genel', category: 'official', emoji: '🇹🇷' },
];

const TEAM_FILTERS = [
  { id: 'all', label: 'Tümü', emoji: '⚽' },
  { id: 'fenerbahce', label: 'Fenerbahçe', emoji: '💛💙' },
  { id: 'galatasaray', label: 'Galatasaray', emoji: '🟡🔴' },
  { id: 'besiktas', label: 'Beşiktaş', emoji: '⚫⚪' },
  { id: 'trabzonspor', label: 'Trabzonspor', emoji: '🔵🟤' },
  { id: 'genel', label: 'Genel', emoji: '🇹🇷' },
];

interface TweetInfo {
  id: string;
  handle: string;
}

export default function TwitterPage() {
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [tweets, setTweets] = useState<TweetInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());

  const filteredAccounts = selectedTeam === 'all'
    ? FOOTBALL_ACCOUNTS
    : FOOTBALL_ACCOUNTS.filter(a => a.team === selectedTeam);

  // Tweetleri fetch et
  const fetchTweets = useCallback(async (handles: string[]) => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/twitter/tweets?handles=${handles.join(',')}&max=3`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setTweets(data.tweets || []);
      if (data.tweets?.length === 0) setError(true);
    } catch {
      setError(true);
      setTweets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // İlk yüklemede ve filtre değiştiğinde tweetleri çek
  useEffect(() => {
    const handles = selectedAccounts.size > 0
      ? Array.from(selectedAccounts)
      : filteredAccounts.map(a => a.handle);
    fetchTweets(handles);
  }, [selectedTeam, selectedAccounts, fetchTweets, filteredAccounts.length]);

  // Hesap toggle
  const toggleAccount = (handle: string) => {
    setSelectedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(handle)) {
        next.delete(handle);
      } else {
        next.add(handle);
      }
      return next;
    });
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
            <div className="hidden md:flex gap-6 text-sm">
              <Link href="/app" className="text-gray-400 hover:text-white transition-colors">
                📺 Ana Sayfa
              </Link>
              <Link href="/app/chat" className="text-gray-400 hover:text-white transition-colors">
                💬 Sohbet
              </Link>
              <span className="text-white font-semibold flex items-center gap-1">
                <XIcon className="w-4 h-4" />
                Twitter
              </span>
              <Link href="/app/channels" className="text-gray-400 hover:text-white transition-colors">
                📡 Kanallar
              </Link>
              <Link href="/app/stats" className="text-gray-400 hover:text-white transition-colors">
                📊 Reyting
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <XIcon className="w-7 h-7" />
            Futbol Twitter Akışı
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Türk futbolunun nabzını Twitter'dan takip edin — tüm hesaplardan güncel tweetler
          </p>
        </div>

        {/* Team Filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          {TEAM_FILTERS.map((filter) => (
            <button
              key={filter.id}
              onClick={() => {
                setSelectedTeam(filter.id);
                setSelectedAccounts(new Set());
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedTeam === filter.id
                  ? 'bg-[#1DA1F2] text-white shadow-lg shadow-[#1DA1F2]/20'
                  : 'bg-[#1e293b] text-gray-400 hover:bg-[#1e293b]/80 hover:text-white border border-white/5'
              }`}
            >
              {filter.emoji} {filter.label}
            </button>
          ))}
        </div>

        {/* 2-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left: Account List */}
          <div className="lg:col-span-1 space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold text-gray-400">Hesaplar</h3>
              {selectedAccounts.size > 0 && (
                <button
                  onClick={() => setSelectedAccounts(new Set())}
                  className="text-xs text-[#1DA1F2] hover:text-[#1DA1F2]/80"
                >
                  Tümünü Göster
                </button>
              )}
            </div>
            <div className="space-y-1 max-h-[600px] overflow-y-auto">
              {filteredAccounts.map((account) => {
                const isSelected = selectedAccounts.size === 0 || selectedAccounts.has(account.handle);
                return (
                  <button
                    key={account.handle}
                    onClick={() => toggleAccount(account.handle)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                      isSelected
                        ? 'bg-[#1DA1F2]/10 border border-[#1DA1F2]/30 text-white'
                        : 'bg-[#1e293b]/50 hover:bg-[#1e293b]/80 border border-transparent text-gray-500'
                    }`}
                  >
                    <span className="text-lg">{account.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{account.name}</p>
                      <p className="text-xs text-gray-500">@{account.handle}</p>
                    </div>
                    {isSelected && selectedAccounts.size > 0 && (
                      <div className="w-2 h-2 rounded-full bg-[#1DA1F2] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Ad */}
            <div className="mt-4">
              <AdBanner slot="sidebar" />
            </div>
          </div>

          {/* Right: Tweet Feed */}
          <div className="lg:col-span-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center text-gray-400 py-16">
                <div className="w-8 h-8 border-2 border-[#1DA1F2] border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm">Tweetler yükleniyor...</p>
              </div>
            ) : error || tweets.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-[#1e293b] p-8 text-center">
                <XIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-300 text-sm mb-1 font-medium">Tweetler yüklenemedi</p>
                <p className="text-gray-500 text-xs mb-4">
                  Twitter API'si şu anda yanıt vermiyor — doğrudan X'ten takip edebilirsiniz
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {filteredAccounts.slice(0, 6).map(acc => (
                    <a
                      key={acc.handle}
                      href={`https://x.com/${acc.handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-white/5 rounded-full text-xs text-gray-400 hover:bg-white/10 hover:text-[#1DA1F2] transition-colors"
                    >
                      {acc.emoji} @{acc.handle}
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs text-gray-500">{tweets.length} tweet bulundu</p>
                  <button
                    onClick={() => {
                      const handles = selectedAccounts.size > 0
                        ? Array.from(selectedAccounts)
                        : filteredAccounts.map(a => a.handle);
                      fetchTweets(handles);
                    }}
                    className="text-xs text-[#1DA1F2] hover:text-[#1DA1F2]/80 flex items-center gap-1"
                  >
                    🔄 Yenile
                  </button>
                </div>

                {/* Tweet kartları */}
                <div className="space-y-3" data-theme="dark">
                  {tweets.map((tweet) => (
                    <div key={tweet.id} className="rounded-xl overflow-hidden [&_article]:!bg-[#1e293b] [&_article]:!border-white/10">
                      <Tweet id={tweet.id} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 border-t border-white/5 py-6 text-center text-xs text-gray-600">
        <p>ZapTube — Türk futbol Twitter akışı</p>
        <p className="mt-1">Takımını seç, tweetleri takip et ⚽</p>
      </footer>
    </div>
  );
}

// X/Twitter icon component
function XIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`fill-current ${className}`} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
