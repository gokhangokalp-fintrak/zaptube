'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';

interface TwitterAccount {
  id: string;
  handle: string;
  name: string;
  team: string;
  category: string;
  emoji: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

const CATEGORIES = [
  { value: 'club', label: 'Kulüp', emoji: '⚽' },
  { value: 'media', label: 'Medya', emoji: '📰' },
  { value: 'journalist', label: 'Gazeteci', emoji: '🎤' },
  { value: 'transfer', label: 'Transfer', emoji: '🔄' },
  { value: 'official', label: 'Resmi', emoji: '🏛' },
  { value: 'fan', label: 'Taraftar', emoji: '🏟' },
];

const TEAMS = [
  { value: 'genel', label: 'Genel' },
  { value: 'galatasaray', label: 'Galatasaray' },
  { value: 'fenerbahce', label: 'Fenerbahçe' },
  { value: 'besiktas', label: 'Beşiktaş' },
  { value: 'trabzonspor', label: 'Trabzonspor' },
];

export default function AdminTwitterPage() {
  const [accounts, setAccounts] = useState<TwitterAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterTeam, setFilterTeam] = useState('all');

  // Form state
  const [form, setForm] = useState({
    handle: '',
    name: '',
    team: 'genel',
    category: 'journalist',
    emoji: '🎤',
    is_active: true,
    sort_order: 0,
  });

  const supabase = createClient();

  const loadAccounts = useCallback(async () => {
    const { data } = await supabase
      .from('twitter_accounts')
      .select('*')
      .order('sort_order', { ascending: true });
    setAccounts(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const resetForm = () => {
    setForm({ handle: '', name: '', team: 'genel', category: 'journalist', emoji: '🎤', is_active: true, sort_order: 0 });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (account: TwitterAccount) => {
    setForm({
      handle: account.handle,
      name: account.name,
      team: account.team,
      category: account.category,
      emoji: account.emoji || '',
      is_active: account.is_active,
      sort_order: account.sort_order,
    });
    setEditingId(account.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      handle: form.handle.replace('@', '').trim(),
      name: form.name.trim(),
      team: form.team,
      category: form.category,
      emoji: form.emoji,
      is_active: form.is_active,
      sort_order: form.sort_order,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      await supabase.from('twitter_accounts').update(payload).eq('id', editingId);
    } else {
      await supabase.from('twitter_accounts').insert(payload);
    }

    setSaving(false);
    resetForm();
    loadAccounts();
  };

  const handleToggleActive = async (id: string, currentState: boolean) => {
    await supabase.from('twitter_accounts').update({ is_active: !currentState }).eq('id', id);
    loadAccounts();
  };

  const handleDelete = async (id: string, handle: string) => {
    if (!confirm(`"@${handle}" hesabını silmek istediğinize emin misiniz?`)) return;
    await supabase.from('twitter_accounts').delete().eq('id', id);
    loadAccounts();
  };

  // Filtreleme
  const filtered = accounts.filter(a => {
    if (filterCategory !== 'all' && a.category !== filterCategory) return false;
    if (filterTeam !== 'all' && a.team !== filterTeam) return false;
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Twitter / X Hesapları</h2>
          <p className="text-gray-400 text-sm mt-1">
            Twitter akışında gösterilecek hesapları yönetin ({accounts.filter(a => a.is_active).length} aktif)
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors flex items-center gap-2"
        >
          <span>+</span> Hesap Ekle
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="mb-6 p-5 rounded-xl bg-[#1e293b] border border-white/10">
          <h3 className="text-white font-semibold mb-4">
            {editingId ? 'Hesabı Düzenle' : 'Yeni Hesap Ekle'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Handle (@)</label>
              <input
                type="text"
                value={form.handle}
                onChange={e => setForm(f => ({ ...f, handle: e.target.value }))}
                placeholder="GalatasaraySK"
                className="w-full px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-white text-sm focus:border-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Görünen Ad</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Galatasaray"
                className="w-full px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-white text-sm focus:border-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Emoji</label>
              <input
                type="text"
                value={form.emoji}
                onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}
                placeholder="🎤"
                className="w-full px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-white text-sm focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Kategori</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-white text-sm focus:border-blue-500 outline-none"
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Takım</label>
              <select
                value={form.team}
                onChange={e => setForm(f => ({ ...f, team: e.target.value }))}
                className="w-full px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-white text-sm focus:border-blue-500 outline-none"
              >
                {TEAMS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Sıralama</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-white text-sm focus:border-blue-500 outline-none"
              />
            </div>
            <div className="col-span-2 md:col-span-3 flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="w-4 h-4 accent-blue-500"
                />
                <span className="text-sm text-gray-300">Aktif</span>
              </label>
              <div className="flex-1"></div>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors disabled:opacity-50"
              >
                {saving ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'Ekle'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="px-3 py-1.5 bg-[#1e293b] border border-white/10 rounded-lg text-sm text-gray-300 outline-none"
        >
          <option value="all">Tüm Kategoriler</option>
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
          ))}
        </select>
        <select
          value={filterTeam}
          onChange={e => setFilterTeam(e.target.value)}
          className="px-3 py-1.5 bg-[#1e293b] border border-white/10 rounded-lg text-sm text-gray-300 outline-none"
        >
          <option value="all">Tüm Takımlar</option>
          {TEAMS.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <span className="text-xs text-gray-500 flex items-center ml-2">
          {filtered.length} hesap gösteriliyor
        </span>
      </div>

      {/* Account List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-400 text-sm">Yükleniyor...</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((account) => (
            <div
              key={account.id}
              className={`flex items-center gap-4 p-3 rounded-xl border transition-all ${
                account.is_active
                  ? 'bg-[#1e293b] border-white/5 hover:border-white/10'
                  : 'bg-[#1e293b]/50 border-white/5 opacity-60'
              }`}
            >
              {/* Emoji */}
              <span className="text-xl w-8 text-center shrink-0">{account.emoji}</span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white font-medium text-sm truncate">{account.name}</p>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    account.category === 'club' ? 'bg-purple-500/20 text-purple-300' :
                    account.category === 'media' ? 'bg-blue-500/20 text-blue-300' :
                    account.category === 'journalist' ? 'bg-orange-500/20 text-orange-300' :
                    account.category === 'transfer' ? 'bg-green-500/20 text-green-300' :
                    'bg-gray-500/20 text-gray-300'
                  }`}>
                    {CATEGORIES.find(c => c.value === account.category)?.label || account.category}
                  </span>
                  {account.team !== 'genel' && (
                    <span className="text-[10px] text-gray-500">
                      {TEAMS.find(t => t.value === account.team)?.label}
                    </span>
                  )}
                </div>
                <a
                  href={`https://x.com/${account.handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-500 hover:text-[#1DA1F2] transition-colors"
                >
                  @{account.handle}
                </a>
              </div>

              {/* Status */}
              <button
                onClick={() => handleToggleActive(account.id, account.is_active)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  account.is_active
                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                    : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                }`}
              >
                {account.is_active ? 'Aktif' : 'Pasif'}
              </button>

              {/* Actions */}
              <button
                onClick={() => handleEdit(account)}
                className="p-1.5 text-gray-400 hover:text-white transition-colors"
                title="Düzenle"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => handleDelete(account.id, account.handle)}
                className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                title="Sil"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              Bu filtreye uygun hesap bulunamadı.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
