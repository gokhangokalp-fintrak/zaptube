'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';

interface Sponsor {
  id: string;
  name: string;
  slot: string;
  image_url: string;
  link_url: string;
  cta_text: string;
  badge: string;
  color: string;
  bg_color: string;
  is_active: boolean;
  start_date: string;
  end_date: string;
  impressions: number;
  clicks: number;
  created_at: string;
}

const SLOTS = [
  { value: 'sidebar', label: 'Sidebar (Sağ Panel)', desc: '300x250 Medium Rectangle' },
  { value: 'player-bottom', label: 'Player Alt Banner', desc: '728x90 Leaderboard' },
  { value: 'chat-top', label: 'Chat Üst Banner', desc: '728x90 Leaderboard' },
  { value: 'stats-inline', label: 'Reyting İçerik Arası', desc: '728x90 Responsive' },
  { value: 'preroll', label: 'Video Pre-roll', desc: '5sn Sponsor Overlay' },
  { value: 'stream-bottom', label: 'Canlı Yayın Alt', desc: '728x90 Leaderboard' },
];

export default function AdminSponsorsPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    slot: 'sidebar',
    image_url: '',
    link_url: '',
    cta_text: '',
    badge: 'Sponsor',
    color: '#10B981',
    bg_color: '',
    is_active: true,
    start_date: '',
    end_date: '',
  });

  const supabase = createClient();

  const loadSponsors = useCallback(async () => {
    const { data } = await supabase
      .from('sponsors')
      .select('*')
      .order('created_at', { ascending: false });
    setSponsors(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadSponsors();
  }, [loadSponsors]);

  const resetForm = () => {
    setForm({
      name: '', slot: 'sidebar', image_url: '', link_url: '', cta_text: '',
      badge: 'Sponsor', color: '#10B981', bg_color: '', is_active: true,
      start_date: '', end_date: '',
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (sponsor: Sponsor) => {
    setForm({
      name: sponsor.name,
      slot: sponsor.slot,
      image_url: sponsor.image_url || '',
      link_url: sponsor.link_url || '',
      cta_text: sponsor.cta_text || '',
      badge: sponsor.badge || 'Sponsor',
      color: sponsor.color || '#10B981',
      bg_color: sponsor.bg_color || '',
      is_active: sponsor.is_active,
      start_date: sponsor.start_date || '',
      end_date: sponsor.end_date || '',
    });
    setEditingId(sponsor.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      ...form,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      await supabase.from('sponsors').update(payload).eq('id', editingId);
    } else {
      await supabase.from('sponsors').insert(payload);
    }

    setSaving(false);
    resetForm();
    loadSponsors();
  };

  const handleToggleActive = async (id: string, currentState: boolean) => {
    await supabase.from('sponsors').update({ is_active: !currentState }).eq('id', id);
    loadSponsors();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" reklamını silmek istediğinize emin misiniz?`)) return;
    await supabase.from('sponsors').delete().eq('id', id);
    loadSponsors();
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Reklam / Sponsor Yönetimi</h2>
          <p className="text-gray-400 text-sm mt-1">
            Sitedeki reklam alanlarını ve sponsorları yönetin ({sponsors.filter(s => s.is_active).length} aktif)
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 transition-colors flex items-center gap-2"
        >
          <span>+</span> Reklam Ekle
        </button>
      </div>

      {/* Slot Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {SLOTS.map((slot) => {
          const count = sponsors.filter(s => s.slot === slot.value && s.is_active).length;
          return (
            <div key={slot.value} className="p-3 rounded-xl bg-[#1e293b] border border-white/5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-white text-sm font-medium">{slot.label}</p>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  count > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {count} aktif
                </span>
              </div>
              <p className="text-[11px] text-gray-500">{slot.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="mb-6 p-5 rounded-xl bg-[#1e293b] border border-white/10">
          <h3 className="text-white font-semibold mb-4">
            {editingId ? 'Reklamı Düzenle' : 'Yeni Reklam Ekle'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Sponsor Adı *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nesine"
                className="w-full px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-white text-sm focus:border-emerald-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Reklam Alanı *</label>
              <select
                value={form.slot}
                onChange={e => setForm(f => ({ ...f, slot: e.target.value }))}
                className="w-full px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-white text-sm focus:border-emerald-500 outline-none"
              >
                {SLOTS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Link URL</label>
              <input
                type="url"
                value={form.link_url}
                onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))}
                placeholder="https://www.nesine.com"
                className="w-full px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-white text-sm focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Görsel URL</label>
              <input
                type="text"
                value={form.image_url}
                onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                placeholder="/sponsors/nesine.png"
                className="w-full px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-white text-sm focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">CTA Metni</label>
              <input
                type="text"
                value={form.cta_text}
                onChange={e => setForm(f => ({ ...f, cta_text: e.target.value }))}
                placeholder="Hemen Oyna"
                className="w-full px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-white text-sm focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Badge</label>
              <input
                type="text"
                value={form.badge}
                onChange={e => setForm(f => ({ ...f, badge: e.target.value }))}
                placeholder="Sponsor"
                className="w-full px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-white text-sm focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Renk</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  className="w-10 h-9 rounded border border-white/10 cursor-pointer"
                />
                <input
                  type="text"
                  value={form.color}
                  onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  className="flex-1 px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-white text-sm outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Başlangıç Tarihi</label>
              <input
                type="date"
                value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-white text-sm focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Bitiş Tarihi</label>
              <input
                type="date"
                value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-white text-sm focus:border-emerald-500 outline-none"
              />
            </div>

            <div className="col-span-2 md:col-span-3 flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="w-4 h-4 accent-emerald-500"
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
                className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50"
              >
                {saving ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'Ekle'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sponsor List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-400 text-sm">Yükleniyor...</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sponsors.map((sponsor) => (
            <div
              key={sponsor.id}
              className={`flex items-center gap-4 p-3 rounded-xl border transition-all ${
                sponsor.is_active
                  ? 'bg-[#1e293b] border-white/5 hover:border-white/10'
                  : 'bg-[#1e293b]/50 border-white/5 opacity-60'
              }`}
            >
              {/* Color dot */}
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: sponsor.color || '#666' }}
              ></div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white font-medium text-sm">{sponsor.name}</p>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-300">
                    {SLOTS.find(s => s.value === sponsor.slot)?.label || sponsor.slot}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {sponsor.link_url && (
                    <a href={sponsor.link_url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-emerald-400 truncate">
                      {sponsor.link_url}
                    </a>
                  )}
                  {(sponsor.impressions > 0 || sponsor.clicks > 0) && (
                    <span className="text-[10px] text-gray-600">
                      {sponsor.impressions} görüntülenme / {sponsor.clicks} tıklama
                    </span>
                  )}
                </div>
              </div>

              {/* Status */}
              <button
                onClick={() => handleToggleActive(sponsor.id, sponsor.is_active)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  sponsor.is_active
                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                    : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                }`}
              >
                {sponsor.is_active ? 'Aktif' : 'Pasif'}
              </button>

              <button onClick={() => handleEdit(sponsor)} className="p-1.5 text-gray-400 hover:text-white transition-colors" title="Düzenle">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button onClick={() => handleDelete(sponsor.id, sponsor.name)} className="p-1.5 text-gray-400 hover:text-red-400 transition-colors" title="Sil">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}

          {sponsors.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              Henüz reklam/sponsor eklenmedi.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
