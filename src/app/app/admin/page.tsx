'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';

interface DashboardStats {
  totalChannels: number;
  activeTwitterAccounts: number;
  activeSponsors: number;
  totalChatMessages: number;
  totalChatRooms: number;
  registeredUsers: number;
  trafficToday: number;
  trafficWeek: number;
  trafficMonth: number;
  uniqueToday: number;
  uniqueWeek: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      const supabase = createClient();

      const [channels, twitter, sponsors, chatMessages, chatRooms] = await Promise.all([
        supabase.from('channels').select('id', { count: 'exact', head: true }),
        supabase.from('twitter_accounts').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('sponsors').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('chat_messages').select('id', { count: 'exact', head: true }),
        supabase.from('chat_rooms').select('id', { count: 'exact', head: true }),
      ]);

      // Kayıtlı üye sayısı (RPC fonksiyonu)
      let registeredUsers = 0;
      try {
        const { data: userCount } = await supabase.rpc('get_registered_user_count');
        registeredUsers = Number(userCount) || 0;
      } catch {
        // Fonksiyon henüz oluşturulmadıysa 0 göster
      }

      // Trafik istatistikleri (RPC fonksiyonu)
      let trafficToday = 0, trafficWeek = 0, trafficMonth = 0, uniqueToday = 0, uniqueWeek = 0;
      try {
        const { data: traffic } = await supabase.rpc('get_traffic_stats');
        if (traffic) {
          trafficToday = Number(traffic.today) || 0;
          trafficWeek = Number(traffic.week) || 0;
          trafficMonth = Number(traffic.month) || 0;
          uniqueToday = Number(traffic.unique_today) || 0;
          uniqueWeek = Number(traffic.unique_week) || 0;
        }
      } catch {
        // Fonksiyon henüz oluşturulmadıysa 0 göster
      }

      setStats({
        totalChannels: channels.count || 0,
        activeTwitterAccounts: twitter.count || 0,
        activeSponsors: sponsors.count || 0,
        totalChatMessages: chatMessages.count || 0,
        totalChatRooms: chatRooms.count || 0,
        registeredUsers,
        trafficToday,
        trafficWeek,
        trafficMonth,
        uniqueToday,
        uniqueWeek,
      });
      setLoading(false);
    }

    loadStats();
  }, []);

  const statCards = [
    { label: 'Kayıtlı Üyeler', value: stats?.registeredUsers ?? '...', icon: '👥', href: '#', color: 'cyan' },
    { label: 'Bugün Ziyaret', value: stats?.trafficToday ?? '...', icon: '📈', href: '#', color: 'yellow', subtitle: stats ? `${stats.uniqueToday} tekil` : '' },
    { label: 'Haftalık Trafik', value: stats?.trafficWeek ?? '...', icon: '📊', href: '#', color: 'pink', subtitle: stats ? `${stats.uniqueWeek} tekil` : '' },
    { label: 'YouTube Kanalları', value: stats?.totalChannels ?? '...', icon: '📺', href: '/app/admin/channels', color: 'red' },
    { label: 'Twitter Hesapları', value: stats?.activeTwitterAccounts ?? '...', icon: '𝕏', href: '/app/admin/twitter', color: 'blue' },
    { label: 'Aktif Reklamlar', value: stats?.activeSponsors ?? '...', icon: '💰', href: '/app/admin/sponsors', color: 'green' },
    { label: 'Chat Mesajları', value: stats?.totalChatMessages ?? '...', icon: '💬', href: '#', color: 'purple' },
    { label: 'Chat Odaları', value: stats?.totalChatRooms ?? '...', icon: '🏠', href: '#', color: 'orange' },
    { label: 'Aylık Trafik', value: stats?.trafficMonth ?? '...', icon: '📅', href: '#', color: 'teal' },
  ];

  const colorMap: Record<string, string> = {
    red: 'bg-red-500/10 border-red-500/20 text-red-400',
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    green: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
    orange: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
    cyan: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
    yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    pink: 'bg-pink-500/10 border-pink-500/20 text-pink-400',
    teal: 'bg-teal-500/10 border-teal-500/20 text-teal-400',
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <p className="text-gray-400 text-sm mt-1">ZapTube site yönetimi genel bakış</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={`p-5 rounded-xl border transition-all hover:scale-[1.02] ${colorMap[card.color]}`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{card.icon}</span>
              {loading && (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin opacity-50"></div>
              )}
            </div>
            <p className="text-3xl font-bold">{typeof card.value === 'number' ? card.value.toLocaleString('tr-TR') : card.value}</p>
            <p className="text-sm opacity-70 mt-1">{card.label}</p>
            {'subtitle' in card && card.subtitle && (
              <p className="text-xs opacity-50 mt-0.5">{card.subtitle}</p>
            )}
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-white mb-4">Hızlı İşlemler</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Link
            href="/app/admin/channels"
            className="flex items-center gap-3 p-4 rounded-xl bg-[#1e293b] border border-white/5 hover:border-red-500/20 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
              ➕
            </div>
            <div>
              <p className="text-white font-medium text-sm">Yeni Kanal Ekle</p>
              <p className="text-gray-500 text-xs">YouTube kanalı ekle veya düzenle</p>
            </div>
          </Link>

          <Link
            href="/app/admin/twitter"
            className="flex items-center gap-3 p-4 rounded-xl bg-[#1e293b] border border-white/5 hover:border-blue-500/20 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
              🐦
            </div>
            <div>
              <p className="text-white font-medium text-sm">Twitter Hesabı Ekle</p>
              <p className="text-gray-500 text-xs">Gazeteci, medya veya kulüp hesabı ekle</p>
            </div>
          </Link>

          <Link
            href="/app/admin/sponsors"
            className="flex items-center gap-3 p-4 rounded-xl bg-[#1e293b] border border-white/5 hover:border-emerald-500/20 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
              📢
            </div>
            <div>
              <p className="text-white font-medium text-sm">Reklam Yönetimi</p>
              <p className="text-gray-500 text-xs">Sponsor ve reklam alanlarını düzenle</p>
            </div>
          </Link>

          <a
            href="https://supabase.com/dashboard/project/ingmixegdyxbsojxshaj"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-xl bg-[#1e293b] border border-white/5 hover:border-green-500/20 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
              🗄
            </div>
            <div>
              <p className="text-white font-medium text-sm">Supabase Dashboard</p>
              <p className="text-gray-500 text-xs">Veritabanı ve auth yönetimi</p>
            </div>
          </a>
        </div>
      </div>

      {/* Site Info */}
      <div className="p-5 rounded-xl bg-[#1e293b] border border-white/5">
        <h3 className="text-lg font-semibold text-white mb-3">Site Bilgileri</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Domain</p>
            <p className="text-white">zaptube.today</p>
          </div>
          <div>
            <p className="text-gray-500">Hosting</p>
            <p className="text-white">Vercel</p>
          </div>
          <div>
            <p className="text-gray-500">Veritabanı</p>
            <p className="text-white">Supabase (PostgreSQL)</p>
          </div>
          <div>
            <p className="text-gray-500">Framework</p>
            <p className="text-white">Next.js 14</p>
          </div>
        </div>
      </div>
    </div>
  );
}
