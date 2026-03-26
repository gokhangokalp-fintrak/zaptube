import { createClient } from './supabase';

// =============================================
// XP ACTIONS & AMOUNTS
// =============================================
export const XP_ACTIONS = {
  SEND_MESSAGE: { action: 'send_message', amount: 5 },
  RECEIVE_LIKE: { action: 'receive_like', amount: 2 },
  VOTE_POLL: { action: 'vote_poll', amount: 3 },
  CREATE_POLL: { action: 'create_poll', amount: 10 },
  FIRST_MESSAGE: { action: 'first_message', amount: 20 },
  DAILY_LOGIN: { action: 'daily_login', amount: 10 },
  FOLLOW_CHANNEL: { action: 'follow_channel', amount: 5 },
} as const;

// =============================================
// LEVEL NAMES
// =============================================
export const LEVEL_NAMES: Record<number, { name: string; emoji: string }> = {
  1: { name: 'Çaylak', emoji: '🌱' },
  2: { name: 'Taraftar', emoji: '🎽' },
  3: { name: 'Fanatik', emoji: '🔥' },
  4: { name: 'Ultra', emoji: '⚡' },
  5: { name: 'Kaptan', emoji: '🫡' },
  6: { name: 'Efsane', emoji: '👑' },
  7: { name: 'Tribün Lideri', emoji: '🏟️' },
  8: { name: 'Şampiyon', emoji: '🏆' },
  9: { name: 'Kral', emoji: '💎' },
  10: { name: 'GOAT', emoji: '🐐' },
};

export function getLevelInfo(level: number) {
  const info = LEVEL_NAMES[Math.min(level, 10)] || LEVEL_NAMES[10];
  return info;
}

export function getXpForNextLevel(level: number): number {
  return level * 100;
}

export function getXpProgress(xp: number, level: number): number {
  const currentLevelXp = (level - 1) * 100;
  const nextLevelXp = level * 100;
  return Math.min(((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100, 100);
}

// =============================================
// BADGE DEFINITIONS
// =============================================
export const BADGE_DEFINITIONS = [
  { type: 'first_message', name: 'İlk Mesaj', emoji: '💬', description: 'İlk mesajını gönderdin!' },
  { type: 'msg_50', name: '50 Mesaj', emoji: '📝', description: '50 mesaj gönderdin!' },
  { type: 'msg_100', name: 'Yüzlük', emoji: '💯', description: '100 mesaj gönderdin!' },
  { type: 'msg_500', name: 'Konuşkan', emoji: '🗣️', description: '500 mesaj gönderdin!' },
  { type: 'likes_10', name: 'Beğenilen', emoji: '❤️', description: '10 beğeni aldın!' },
  { type: 'likes_50', name: 'Popüler', emoji: '🌟', description: '50 beğeni aldın!' },
  { type: 'poll_creator', name: 'Anketçi', emoji: '📊', description: 'İlk anketini oluşturdun!' },
  { type: 'voter', name: 'Oycu', emoji: '🗳️', description: '10 ankete oy verdin!' },
  { type: 'level_5', name: 'Kaptan', emoji: '🫡', description: 'Seviye 5\'e ulaştın!' },
  { type: 'level_10', name: 'GOAT', emoji: '🐐', description: 'Seviye 10\'a ulaştın!' },
  { type: 'night_owl', name: 'Gece Kuşu', emoji: '🦉', description: 'Gece 2-5 arası mesaj attın!' },
  { type: 'early_bird', name: 'Erken Kuş', emoji: '🐦', description: 'Sabah 5-7 arası mesaj attın!' },
];

// =============================================
// USER PROFILE FUNCTIONS
// =============================================
// İlk 1000 üye otomatik Seviye 3 (Fanatik) başlar
const EARLY_BIRD_LIMIT = 1000;
const EARLY_BIRD_LEVEL = 3;
const EARLY_BIRD_XP = 200; // Seviye 3 için gereken XP

export async function getUserProfile(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code === 'PGRST116') {
    // No profile yet — check if early bird (first 1000 users)
    const { count } = await supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true });

    const isEarlyBird = (count || 0) < EARLY_BIRD_LIMIT;
    const startLevel = isEarlyBird ? EARLY_BIRD_LEVEL : 1;
    const startXp = isEarlyBird ? EARLY_BIRD_XP : 0;

    const { data: newProfile } = await supabase
      .from('user_profiles')
      .insert({ user_id: userId, xp: startXp, level: startLevel })
      .select()
      .single();
    return newProfile;
  }
  return data;
}

export async function updateSelectedTeam(userId: string, team: string | null) {
  const supabase = createClient();
  await supabase
    .from('user_profiles')
    .upsert({ user_id: userId, selected_team: team, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
}

export async function addXp(userId: string, action: string, amount: number): Promise<number> {
  const supabase = createClient();
  const { data } = await supabase.rpc('add_xp', {
    p_user_id: userId,
    p_action: action,
    p_amount: amount,
  });
  return data || 0;
}

export async function getUserBadges(userId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from('user_badges')
    .select('*')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false });
  return data || [];
}

export async function awardBadge(userId: string, badgeType: string) {
  const badge = BADGE_DEFINITIONS.find(b => b.type === badgeType);
  if (!badge) return;

  const supabase = createClient();
  await supabase
    .from('user_badges')
    .upsert({
      user_id: userId,
      badge_type: badgeType,
      badge_name: badge.name,
      badge_emoji: badge.emoji,
    }, { onConflict: 'user_id,badge_type' });
}

// =============================================
// LEADERBOARD
// =============================================
export async function getLeaderboard(limit = 10) {
  const supabase = createClient();
  const { data } = await supabase
    .from('user_profiles')
    .select('user_id, display_name, xp, level, selected_team')
    .order('xp', { ascending: false })
    .limit(limit);
  return data || [];
}

// =============================================
// POLL FUNCTIONS
// =============================================
export interface Poll {
  id: string;
  room_id: string | null;
  created_by: string;
  question: string;
  options: string[];
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface PollVote {
  id: string;
  poll_id: string;
  user_id: string;
  option_index: number;
}

export async function createPoll(
  roomId: string | null,
  userId: string,
  question: string,
  options: string[],
  endsAt?: string
): Promise<Poll | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('polls')
    .insert({
      room_id: roomId,
      created_by: userId,
      question,
      options: JSON.stringify(options),
      ends_at: endsAt || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getActivePolls(roomId?: string): Promise<Poll[]> {
  const supabase = createClient();
  let query = supabase
    .from('polls')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(5);

  if (roomId) {
    query = query.eq('room_id', roomId);
  }

  const { data } = await query;
  return (data || []).map(p => ({
    ...p,
    options: typeof p.options === 'string' ? JSON.parse(p.options) : p.options,
  }));
}

export async function votePoll(pollId: string, userId: string, optionIndex: number) {
  const supabase = createClient();
  const { error } = await supabase
    .from('poll_votes')
    .insert({ poll_id: pollId, user_id: userId, option_index: optionIndex });

  if (error) {
    if (error.code === '23505') throw new Error('Zaten oy verdiniz!');
    throw error;
  }
}

export async function getPollVotes(pollId: string): Promise<Record<number, number>> {
  const supabase = createClient();
  const { data } = await supabase
    .from('poll_votes')
    .select('option_index')
    .eq('poll_id', pollId);

  const counts: Record<number, number> = {};
  (data || []).forEach(v => {
    counts[v.option_index] = (counts[v.option_index] || 0) + 1;
  });
  return counts;
}

export async function getUserVote(pollId: string, userId: string): Promise<number | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('poll_votes')
    .select('option_index')
    .eq('poll_id', pollId)
    .eq('user_id', userId)
    .single();

  return data?.option_index ?? null;
}
