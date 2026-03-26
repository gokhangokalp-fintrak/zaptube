'use client';

import Link from 'next/link';
import TwitterTimeline, { FOOTBALL_ACCOUNTS } from '@/components/TwitterTimeline';
import { useState } from 'react';
import AdBanner from '@/components/ads/AdBanner';

// Team filter categories
const TEAM_FILTERS = [
  { id: 'all', label: 'Tümü', emoji: '⚽' },
  { id: 'fenerbahce', label: 'Fenerbahçe', emoji: '💛💙' },
  { id: 'galatasaray', label: 'Galatasaray', emoji: '🟡🔴' },
  { id: 'besiktas', label: 'Beşiktaş', emoji: '⚫⚪' },
  { id: 'trabzonspor', label: 'Trabzonspor', emoji: '🔵🟤' },
  { id: 'genel', label: 'Genel', emoji: '🇹🇷' },
];

export default function TwitterPage() {
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [selectedAccount, setSelectedAccount] = useState(FOOTBALL_ACCOUNTS[0].handle);

  const filteredAccounts = selectedTeam === 'all'
    ? FOOTBALL_ACCOUNTS
    : FOOTBALL_ACCOUNTS.filter(a => a.team === selectedTeam);

  const currentAccount = FOOTBALL_ACCOUNTS.find(a => a.handle === selectedAccount);

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
              <Link href="/app" className="text-gray-400 hover:text-white transition-colors">
                📺 Ana Sayfa
              </Link>
              <Link href="/app/chat" className="text-gray-400 hover:text-white transition-colors">
                💬 Sohbet
              </Link>
              <span className="text-white font-semibold flex items-center gap-1">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
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
            <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current text-white" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Futbol Twitter Akışı
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Türk futbolunun nabzını Twitter'dan takip edin
          </p>
        </div>

        {/* Team Filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          {TEAM_FILTERS.map((filter) => (
            <button
              key={filter.id}
              onClick={() => {
                setSelectedTeam(filter.id);
                const firstInTeam = filter.id === 'all'
                  ? FOOTBALL_ACCOUNTS[0]
                  : FOOTBALL_ACCOUNTS.find(a => a.team === filter.id);
                if (firstInTeam) setSelectedAccount(firstInTeam.handle);
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
            <h3 className="text-sm font-semibold text-gray-400 px-1">Hesaplar</h3>
            <div className="space-y-1">
              {filteredAccounts.map((account) => (
                <button
                  key={account.handle}
                  onClick={() => setSelectedAccount(account.handle)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                    selectedAccount === account.handle
                      ? 'bg-[#1DA1F2]/10 border border-[#1DA1F2]/30 text-white'
                      : 'bg-[#1e293b] hover:bg-[#1e293b]/80 border border-transparent text-gray-300'
                  }`}
                >
                  <span className="text-lg">{account.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{account.name}</p>
                    <p className="text-xs text-gray-500">@{account.handle}</p>
                  </div>
                  {selectedAccount === account.handle && (
                    <div className="w-2 h-2 rounded-full bg-[#1DA1F2] shrink-0"></div>
                  )}
                </button>
              ))}
            </div>

            {/* Ad */}
            <div className="mt-4">
              <AdBanner slot="sidebar" />
            </div>
          </div>

          {/* Right: Twitter Timeline */}
          <div className="lg:col-span-3">
            <TwitterTimeline
              handle={selectedAccount}
              height={700}
              theme="dark"
              showSelector={false}
            />
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
