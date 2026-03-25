'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { getUserProfile, updateSelectedTeam, getLevelInfo, getXpProgress, getUserBadges, getLeaderboard } from '@/lib/gamification';

const TEAMS = [
  { id: 'gs', name: 'Galatasaray', emoji: '🦁', colors: 'from-yellow-500 to-red-600' },
  { id: 'fb', name: 'Fenerbahçe', emoji: '🐤', colors: 'from-blue-600 to-yellow-500' },
  { id: 'bjk', name: 'Beşiktaş', emoji: '🦅', colors: 'from-gray-900 to-white' },
  { id: 'ts', name: 'Trabzonspor', emoji: '⭐', colors: 'from-red-800 to-blue-700' },
];

interface LeaderEntry {
  user_id: string;
  display_name: string | null;
  xp: number;
  level: number;
  selected_team: string | null;
}

export default function UserProfileWidget() {
  const [profile, setProfile] = useState<any>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [tab, setTab] = useState<'profile' | 'leaderboard' | 'badges'>('profile');

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [p, b, lb] = await Promise.all([
        getUserProfile(user.id),
        getUserBadges(user.id),
        getLeaderboard(10),
      ]);
      setProfile(p);
      setBadges(b);
      setLeaderboard(lb);
    };
    init();
  }, []);

  if (!profile) return null;

  const levelInfo = getLevelInfo(profile.level);
  const xpProgress = getXpProgress(profile.xp, profile.level);
  const selectedTeam = TEAMS.find(t => t.id === profile.selected_team);

  const handleTeamSelect = async (teamId: string) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await updateSelectedTeam(user.id, teamId);
    setProfile({ ...profile, selected_team: teamId });
    setShowTeamPicker(false);
  };

  return (
    <div className="bg-[#1a1a2e] rounded-xl border border-white/10 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {[
          { id: 'profile' as const, label: '👤 Profil' },
          { id: 'leaderboard' as const, label: '🏆 Sıralama' },
          { id: 'badges' as const, label: '🎖️ Rozetler' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
              tab === t.id ? 'text-red-400 bg-red-500/10 border-b-2 border-red-500' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {tab === 'profile' && (
        <div className="p-4">
          {/* Level & XP */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center text-2xl shadow-lg shadow-red-500/20">
              {levelInfo.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-sm">{levelInfo.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">
                  LVL {profile.level}
                </span>
              </div>
              <div className="mt-1.5">
                <div className="flex justify-between mb-0.5">
                  <span className="text-[10px] text-gray-500">{profile.xp} XP</span>
                  <span className="text-[10px] text-gray-500">{profile.level * 100} XP</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full transition-all duration-500"
                    style={{ width: `${xpProgress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Team Selection */}
          <div className="mb-3">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">Takımın</p>
            {selectedTeam ? (
              <button
                onClick={() => setShowTeamPicker(!showTeamPicker)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r ${selectedTeam.colors} bg-opacity-20 border border-white/10 transition-all hover:brightness-110`}
              >
                <span className="text-xl">{selectedTeam.emoji}</span>
                <span className="text-white text-sm font-bold">{selectedTeam.name}</span>
                <span className="text-gray-400 text-xs ml-auto">Değiştir</span>
              </button>
            ) : (
              <button
                onClick={() => setShowTeamPicker(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/5 border border-dashed border-white/20 text-gray-400 text-sm hover:bg-white/10 transition-colors"
              >
                ⚽ Takımını Seç
              </button>
            )}
          </div>

          {showTeamPicker && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {TEAMS.map(team => (
                <button
                  key={team.id}
                  onClick={() => handleTeamSelect(team.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all hover:scale-[1.02] active:scale-95 ${
                    profile.selected_team === team.id
                      ? 'border-red-500 bg-red-500/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <span className="text-lg">{team.emoji}</span>
                  <span className="text-xs font-bold text-white">{team.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* XP Actions Info */}
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">XP Kazan</p>
            <div className="space-y-1.5">
              {[
                { action: 'Mesaj gönder', xp: '+5 XP', emoji: '💬' },
                { action: 'Beğeni al', xp: '+2 XP', emoji: '❤️' },
                { action: 'Anket oluştur', xp: '+10 XP', emoji: '📊' },
                { action: 'Oy ver', xp: '+3 XP', emoji: '🗳️' },
                { action: 'Kanal takip et', xp: '+5 XP', emoji: '📺' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{item.emoji} {item.action}</span>
                  <span className="text-xs text-green-400 font-bold">{item.xp}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Tab */}
      {tab === 'leaderboard' && (
        <div className="p-3">
          <div className="space-y-1">
            {leaderboard.map((entry, idx) => {
              const team = TEAMS.find(t => t.id === entry.selected_team);
              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
              return (
                <div
                  key={entry.user_id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    idx < 3 ? 'bg-white/5' : 'hover:bg-white/5'
                  }`}
                >
                  <span className="text-sm w-6 text-center font-bold">{medal}</span>
                  {team && <span className="text-sm">{team.emoji}</span>}
                  <span className="text-xs text-white font-medium flex-1 truncate">
                    {entry.display_name || 'Anonim'}
                  </span>
                  <div className="text-right">
                    <span className="text-xs text-yellow-400 font-bold">{entry.xp} XP</span>
                    <span className="text-[10px] text-gray-500 ml-1">LVL{entry.level}</span>
                  </div>
                </div>
              );
            })}
            {leaderboard.length === 0 && (
              <p className="text-center text-gray-500 text-xs py-4">Henüz sıralama yok</p>
            )}
          </div>
        </div>
      )}

      {/* Badges Tab */}
      {tab === 'badges' && (
        <div className="p-3">
          <div className="grid grid-cols-3 gap-2">
            {badges.length > 0 ? badges.map(badge => (
              <div key={badge.id} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white/5">
                <span className="text-2xl">{badge.badge_emoji}</span>
                <span className="text-[10px] text-white font-bold text-center">{badge.badge_name}</span>
              </div>
            )) : (
              <div className="col-span-3 text-center py-6">
                <p className="text-3xl mb-2">🏅</p>
                <p className="text-xs text-gray-500">Henüz rozet kazanmadın</p>
                <p className="text-[10px] text-gray-600 mt-1">Mesaj at, oy ver, aktif ol!</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
