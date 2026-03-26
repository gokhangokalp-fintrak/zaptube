import { createServerSupabaseClient } from './supabase-server';

// Admin yetki kontrolü
export async function isAdmin(): Promise<boolean> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return false;

    const { data } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', user.email)
      .single();

    return !!data;
  } catch {
    return false;
  }
}

// Admin kullanıcı bilgisi
export async function getAdminUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data } = await supabase
    .from('admin_users')
    .select('*')
    .eq('email', user.email)
    .single();

  return data ? { ...data, auth_user: user } : null;
}

// === CHANNELS ===
export async function getChannels() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('channels')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

// === TWITTER ACCOUNTS ===
export async function getTwitterAccounts() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('twitter_accounts')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

// === SPONSORS ===
export async function getSponsors() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('sponsors')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// === SITE SETTINGS ===
export async function getSiteSettings() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('site_settings')
    .select('*');
  if (error) throw error;

  const settings: Record<string, unknown> = {};
  (data || []).forEach((s: { key: string; value: unknown }) => {
    settings[s.key] = s.value;
  });
  return settings;
}

// === DASHBOARD STATS ===
export async function getDashboardStats() {
  const supabase = await createServerSupabaseClient();

  const [channels, twitter, sponsors, chatMessages, chatRooms] = await Promise.all([
    supabase.from('channels').select('id', { count: 'exact', head: true }),
    supabase.from('twitter_accounts').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('sponsors').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('chat_messages').select('id', { count: 'exact', head: true }),
    supabase.from('chat_rooms').select('id', { count: 'exact', head: true }),
  ]);

  return {
    totalChannels: channels.count || 0,
    activeTwitterAccounts: twitter.count || 0,
    activeSponsors: sponsors.count || 0,
    totalChatMessages: chatMessages.count || 0,
    totalChatRooms: chatRooms.count || 0,
  };
}
