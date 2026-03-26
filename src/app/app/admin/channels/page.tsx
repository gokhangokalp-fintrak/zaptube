'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';

interface Channel {
  id: string;
  name: string;
  slug: string;
  youtube_channel_id: string;
  youtube_handle: string;
  thumbnail: string;
  subscriber_count: number;
  video_count: number;
  description: string;
  teams: string[];
  content_types: string[];
  tone: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

const TEAM_OPTIONS = ['genel', 'galatasaray', 'fenerbahce', 'besiktas', 'trabzonspor'];
const CONTENT_OPTIONS = ['ozet', 'analiz', 'yorum', 'sert-yorum', 'eglence', 'canli-yayin', 'taktik', 'transfer', 'haber'];
const TONE_OPTIONS = ['dengeli', 'eglenceli', 'sert', 'teknik', 'heyecanli', 'ciddi'];

export default function AdminChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importStatus, setImportStatus] = useState('');

  const [form, setForm] = useState({
    name: '',
    slug: '',
    youtube_channel_id: '',
    youtube_handle: '',
    thumbnail: '',
    subscriber_count: 0,
    description: '',
    teams: ['genel'] as string[],
    content_types: [] as string[],
    tone: 'dengeli',
    is_active: true,
    sort_order: 0,
  });

  const supabase = createClient();

  const loadChannels = useCallback(async () => {
    const { data } = await supabase
      .from('channels')
      .select('*')
      .order('sort_order', { ascending: true });
    setChannels(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  // channels.json'dan import
  const importFromJson = async () => {
    setImportStatus('Yükleniyor...');
    try {
      const res = await fetch('/api/channel-stats');
      if (!res.ok) throw new Error('API error');
      const data = await res.json();

      // channels.json'dan gelen veriyi al
      const jsonRes = await fetch('/data/channels.json');
      if (!jsonRes.ok) {
        // Direkt data dizininden dene
        setImportStatus('channels.json bulunamadı, mevcut kanal verisi kullanılıyor');
        return;
      }
      const jsonChannels = await jsonRes.json();

      let imported = 0;
      for (const ch of jsonChannels) {
        const payload = {
          name: ch.name,
          slug: ch.slug,
          youtube_channel_id: ch.youtubeChannelId || ch.youtube_channel_id || '',
          youtube_handle: ch.youtubeHandle || ch.youtube_handle || '',
          thumbnail: ch.thumbnail || '',
          subscriber_count: ch.subscriberCount || ch.subscriber_count || 0,
          description: ch.description || '',
          teams: ch.teams || ['genel'],
          content_types: ch.contentTypes || ch.content_types || [],
          tone: ch.tone || 'dengeli',
          is_active: true,
          sort_order: imported,
        };

        const { error } = await supabase
          .from('channels')
          .upsert(payload, { onConflict: 'slug' });

        if (!error) imported++;
      }

      setImportStatus(`${imported} kanal import edildi!`);
      loadChannels();
    } catch (err) {
      setImportStatus('Import hatası: ' + (err instanceof Error ? err.message : 'bilinmeyen'));
    }
  };

  const resetForm = () => {
    setForm({
      name: '', slug: '', youtube_channel_id: '', youtube_handle: '',
      thumbnail: '', subscriber_count: 0, description: '',
      teams: ['genel'], content_types: [], tone: 'dengeli',
      is_active: true, sort_order: 0,
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (channel: Channel) => {
    setForm({
      name: channel.name,
      slug: channel.slug,
      youtube_channel_id: channel.youtube_channel_id,
      youtube_handle: channel.youtube_handle || '',
      thumbnail: channel.thumbnail || '',
      subscriber_count: channel.subscriber_count,
      description: channel.description || '',
      teams: channel.teams || ['genel'],
      content_types: channel.content_types || [],
      tone: channel.tone || 'dengeli',
      is_active: channel.is_active,
      sort_order: channel.sort_order,
    });
    setEditingId(channel.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      ...form,
      slug: form.slug || form.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      await supabase.from('channels').update(payload).eq('id', editingId);
    } else {
      await supabase.from('channels').insert(payload);
    }

    setSaving(false);
    resetForm();
    loadChannels();
  };

  const handleToggleActive = async (id: string, currentState: boolean) => {
    await supabase.from('channels').update({ is_active: !currentState }).eq('id', id);
    loadChannels();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" kanalını silmek istediğinize emin misiniz?`)) return;
    await supabase.from('channels').delete().eq('id', id);
    loadChannels();
  };

  const toggleArrayItem = (arr: string[], item: string) => {
    return arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">YouTube Kanalları</h2>
          <p className="text-gray-400 text-sm mt-1">
            Sitede gösterilecek YouTube kanallarını yönetin ({channels.length} kanal)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={importFromJson}
            className="px-3 py-2 bg-[#1e293b] text-gray-300 rounded-lg text-sm hover:bg-[#1e293b]/80 transition-colors border border-white/5"
          >
            JSON'dan Import
          </button>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-500 transition-colors flex items-center gap-2"
          >
            <span>+</span> Kanal Ekle
          </button>
        </div>
      </div>

      {importStatus && (
        <div className="mb-4 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-300">
          {importStatus}
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="mb-6 p-5 rounded-xl bg-[#1e293b] border border-white/10">
          <h3 className="text-white font-semibold mb-4">
            {editingId ? 'Kanalı Düzenle' : 'Yeni Kanal Ekle'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Kanal Adı *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Erman Toroğlu"
                  className="w-full px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-white text-sm focus:border-red-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Slug</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                  placeholder="erman-toroglu"
                  className="w-full px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-white text-sm focus:border-red-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">YouTube Channel ID *</label>
                <input
                  type="text"
                  value={form.youtube_channel_id}
                  onChange={e => setForm(f => ({ ...f, youtube_channel_id: e.target.value }))}
                  placeholder="UCxxxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-white text-sm focus:border-red-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">YouTube Handle</label>
                <input
                  type="text"
                  value={form.youtube_handle}
                  onChange={e => setForm(f => ({ ...f, youtube_handle: e.target.value }))}
                  placeholder="@ErmanToroglu"
                  className="w-full px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-white text-sm focus:border-red-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Thumbnail URL</label>
                <input
                  type="text"
                  value={form.thumbnail}
                  onChange={e => setForm(f => ({ ...f, thumbnail: e.target.value }))}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-white text-sm focus:border-red-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Ton</label>
                <select
                  value={form.tone}
                  onChange={e => setForm(f => ({ ...f, tone: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-white text-sm focus:border-red-500 outline-none"
                >
                  {TONE_OPTIONS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Açıklama</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Kanal açıklaması..."
                rows={2}
                className="w-full px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-white text-sm focus:border-red-500 outline-none resize-none"
              />
            </div>

            {/* Teams */}
            <div>
              <label className="block text-xs text-gray-400 mb-2">Takımlar</label>
              <div className="flex flex-wrap gap-2">
                {TEAM_OPTIONS.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, teams: toggleArrayItem(f.teams, t) }))}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      form.teams.includes(t)
                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                        : 'bg-white/5 text-gray-400 border border-white/10'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Types */}
            <div>
              <label className="block text-xs text-gray-400 mb-2">İçerik Türleri</label>
              <div className="flex flex-wrap gap-2">
                {CONTENT_OPTIONS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, content_types: toggleArrayItem(f.content_types, c) }))}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      form.content_types.includes(c)
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'bg-white/5 text-gray-400 border border-white/10'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="w-4 h-4 accent-red-500"
                />
                <span className="text-sm text-gray-300">Aktif</span>
              </label>
              <div className="flex-1"></div>
              <button type="button" onClick={resetForm} className="px-4 py-2 text-gray-400 hover:text-white text-sm">
                İptal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                {saving ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'Ekle'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Channel List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-red-400 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-400 text-sm">Yükleniyor...</p>
        </div>
      ) : (
        <div className="space-y-2">
          {channels.map((ch) => (
            <div
              key={ch.id}
              className={`flex items-center gap-4 p-3 rounded-xl border transition-all ${
                ch.is_active
                  ? 'bg-[#1e293b] border-white/5 hover:border-white/10'
                  : 'bg-[#1e293b]/50 border-white/5 opacity-60'
              }`}
            >
              {/* Thumbnail */}
              <div className="w-10 h-10 rounded-lg bg-[#111827] overflow-hidden shrink-0">
                {ch.thumbnail ? (
                  <img src={ch.thumbnail} alt={ch.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg">📺</div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white font-medium text-sm truncate">{ch.name}</p>
                  {ch.subscriber_count > 0 && (
                    <span className="text-[10px] text-gray-500">
                      {(ch.subscriber_count / 1000).toFixed(0)}K abone
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500">{ch.slug}</span>
                  {ch.teams?.filter(t => t !== 'genel').map(t => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-300">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Status */}
              <button
                onClick={() => handleToggleActive(ch.id, ch.is_active)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  ch.is_active
                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                    : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                }`}
              >
                {ch.is_active ? 'Aktif' : 'Pasif'}
              </button>

              {/* Actions */}
              <button onClick={() => handleEdit(ch)} className="p-1.5 text-gray-400 hover:text-white transition-colors" title="Düzenle">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button onClick={() => handleDelete(ch.id, ch.name)} className="p-1.5 text-gray-400 hover:text-red-400 transition-colors" title="Sil">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}

          {channels.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm mb-3">Henüz kanal eklenmedi.</p>
              <button
                onClick={importFromJson}
                className="px-4 py-2 bg-red-600/20 text-red-300 rounded-lg text-sm hover:bg-red-600/30 transition-colors"
              >
                channels.json'dan Import Et
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
