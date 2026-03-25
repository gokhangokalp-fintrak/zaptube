import { createClient } from './supabase';
import { UserChannelPreference } from '@/types';

const MAX_FOLLOWS = 20;
const MAX_FAVORITES = 5;

export async function getUserPreferences(userId: string): Promise<UserChannelPreference[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('user_channel_preferences')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching preferences:', error);
    return [];
  }
  return data || [];
}

export async function toggleFollow(
  userId: string,
  channelId: string
): Promise<{ success: boolean; isFollowing: boolean; error?: string }> {
  const supabase = createClient();

  // Check existing preference
  const { data: existing } = await supabase
    .from('user_channel_preferences')
    .select('*')
    .eq('user_id', userId)
    .eq('channel_id', channelId)
    .single();

  if (existing) {
    const newFollowing = !existing.is_following;

    // If trying to follow, check limit
    if (newFollowing) {
      const { count } = await supabase
        .from('user_channel_preferences')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_following', true);

      if ((count || 0) >= MAX_FOLLOWS) {
        return { success: false, isFollowing: false, error: `En fazla ${MAX_FOLLOWS} kanal takip edebilirsiniz` };
      }
    }

    // If unfollowing, also remove favorite
    const updates: Record<string, boolean | string> = {
      is_following: newFollowing,
      updated_at: new Date().toISOString(),
    };
    if (!newFollowing) {
      updates.is_favorite = false;
    }

    const { error } = await supabase
      .from('user_channel_preferences')
      .update(updates)
      .eq('id', existing.id);

    if (error) return { success: false, isFollowing: existing.is_following, error: error.message };
    return { success: true, isFollowing: newFollowing };
  } else {
    // Check follow limit before insert
    const { count } = await supabase
      .from('user_channel_preferences')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_following', true);

    if ((count || 0) >= MAX_FOLLOWS) {
      return { success: false, isFollowing: false, error: `En fazla ${MAX_FOLLOWS} kanal takip edebilirsiniz` };
    }

    const { error } = await supabase
      .from('user_channel_preferences')
      .insert({
        user_id: userId,
        channel_id: channelId,
        is_following: true,
        is_favorite: false,
      });

    if (error) return { success: false, isFollowing: false, error: error.message };
    return { success: true, isFollowing: true };
  }
}

export async function toggleFavorite(
  userId: string,
  channelId: string
): Promise<{ success: boolean; isFavorite: boolean; error?: string }> {
  const supabase = createClient();

  // Check existing preference
  const { data: existing } = await supabase
    .from('user_channel_preferences')
    .select('*')
    .eq('user_id', userId)
    .eq('channel_id', channelId)
    .single();

  if (existing) {
    const newFavorite = !existing.is_favorite;

    // If trying to favorite, check limit
    if (newFavorite) {
      const { count } = await supabase
        .from('user_channel_preferences')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_favorite', true);

      if ((count || 0) >= MAX_FAVORITES) {
        return { success: false, isFavorite: false, error: `En fazla ${MAX_FAVORITES} favori kanal seçebilirsiniz` };
      }
    }

    // Must be following to be favorite
    const { error } = await supabase
      .from('user_channel_preferences')
      .update({
        is_favorite: newFavorite,
        is_following: newFavorite ? true : existing.is_following,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) return { success: false, isFavorite: existing.is_favorite, error: error.message };
    return { success: true, isFavorite: newFavorite };
  } else {
    // Check favorite limit
    const { count } = await supabase
      .from('user_channel_preferences')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_favorite', true);

    if ((count || 0) >= MAX_FAVORITES) {
      return { success: false, isFavorite: false, error: `En fazla ${MAX_FAVORITES} favori kanal seçebilirsiniz` };
    }

    // Insert as both following and favorite
    const { error } = await supabase
      .from('user_channel_preferences')
      .insert({
        user_id: userId,
        channel_id: channelId,
        is_following: true,
        is_favorite: true,
      });

    if (error) return { success: false, isFavorite: false, error: error.message };
    return { success: true, isFavorite: true };
  }
}
