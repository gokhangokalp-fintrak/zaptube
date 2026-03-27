'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';

interface UserData {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  provider: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadUsers = useCallback(async () => {
    const supabase = createClient();
    try {
      const { data, error } = await supabase.rpc('get_all_users');
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Üyeler yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = users.filter((user) => {
    const q = search.toLowerCase();
    return (
      (user.email?.toLowerCase().includes(q)) ||
      (user.full_name?.toLowerCase().includes(q))
    );
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeSince = (dateStr: string) => {
    const now = new Date();
    const d = new Date(dateStr);
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 60) return `${diffMinutes} dk önce`;
    if (diffHours < 24) return `${diffHours} saat önce`;
    if (diffDays === 1) return 'Dün';
    return `${diffDays} gün önce`;
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Üyeler</h2>
          <p className="text-gray-400 text-sm mt-1">
            Kayıtlı kullanıcıları görüntüle ({users.length} üye)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium">
            👥 {users.length} Üye
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="İsim veya e-posta ile ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-80 px-4 py-2.5 rounded-xl bg-[#111827] border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-gray-400">Üyeler yükleniyor...</span>
        </div>
      )}

      {/* Users Table */}
      {!loading && (
        <div className="rounded-xl border border-white/5 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#111827] border-b border-white/5">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Üye</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">E-posta</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Giriş Yöntemi</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Kayıt Tarihi</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Son Giriş</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                >
                  {/* User Info */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.full_name || ''}
                          className="w-9 h-9 rounded-full object-cover border border-white/10"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-sm text-cyan-400 font-medium">
                          {(user.full_name || user.email || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-white text-sm font-medium">
                        {user.full_name || 'İsimsiz'}
                      </span>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-4 py-3">
                    <span className="text-gray-400 text-sm">{user.email}</span>
                  </td>

                  {/* Provider */}
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 border border-blue-500/20 text-blue-400">
                      {user.provider === 'google' ? '🔵 Google' : user.provider || 'E-posta'}
                    </span>
                  </td>

                  {/* Created */}
                  <td className="px-4 py-3">
                    <div>
                      <span className="text-gray-300 text-sm">{formatDate(user.created_at)}</span>
                      <p className="text-gray-600 text-xs">{getTimeSince(user.created_at)}</p>
                    </div>
                  </td>

                  {/* Last Sign In */}
                  <td className="px-4 py-3">
                    <div>
                      <span className="text-gray-300 text-sm">{formatDate(user.last_sign_in_at)}</span>
                      {user.last_sign_in_at && (
                        <p className="text-gray-600 text-xs">{getTimeSince(user.last_sign_in_at)}</p>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredUsers.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    {search ? 'Arama sonucu bulunamadı.' : 'Henüz kayıtlı üye yok.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
