import { createClient } from './supabase';
import type { ChatRoom, ChatMessage, ReactionCount, ChatRoomStats } from '@/types';

export async function getChatRooms(): Promise<ChatRoom[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('chat_rooms')
    .select('*')
    .order('type', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getRoomBySlug(slug: string): Promise<ChatRoom | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('chat_rooms')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function getMessages(roomId: string, limit = 50): Promise<ChatMessage[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).reverse();
}

export async function sendMessage(
  roomId: string,
  userId: string,
  userName: string,
  userAvatar: string,
  content: string
): Promise<ChatMessage | null> {
  if (content.length > 500) {
    throw new Error('Message exceeds 500 character limit');
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from('chat_messages')
    .insert([
      {
        room_id: roomId,
        user_id: userId,
        user_name: userName,
        user_avatar: userAvatar,
        content,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteMessage(messageId: string, userId: string): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('id', messageId)
    .eq('user_id', userId);

  if (error) throw error;
  return true;
}

export async function toggleReaction(
  messageId: string,
  userId: string,
  emoji: string
): Promise<{ added: boolean }> {
  const supabase = createClient();

  const { data: existing, error: checkError } = await supabase
    .from('chat_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .eq('emoji', emoji)
    .single();

  if (checkError && checkError.code !== 'PGRST116') {
    throw checkError;
  }

  if (existing) {
    const { error: deleteError } = await supabase
      .from('chat_reactions')
      .delete()
      .eq('id', existing.id);

    if (deleteError) throw deleteError;
    return { added: false };
  } else {
    const { error: insertError } = await supabase
      .from('chat_reactions')
      .insert([
        {
          message_id: messageId,
          user_id: userId,
          emoji,
        },
      ]);

    if (insertError) throw insertError;
    return { added: true };
  }
}

export async function getReactionCounts(
  messageIds: string[],
  userId: string
): Promise<Record<string, ReactionCount[]>> {
  if (messageIds.length === 0) return {};

  const supabase = createClient();

  const { data, error } = await supabase
    .from('chat_reactions')
    .select('message_id, emoji, user_id')
    .in('message_id', messageIds);

  if (error) throw error;

  const result: Record<string, ReactionCount[]> = {};
  const reactionMap: Record<string, Record<string, { count: number; user_reacted: boolean }>> = {};

  messageIds.forEach((id) => {
    reactionMap[id] = {};
  });

  data?.forEach((reaction) => {
    if (!reactionMap[reaction.message_id]) {
      reactionMap[reaction.message_id] = {};
    }

    if (!reactionMap[reaction.message_id][reaction.emoji]) {
      reactionMap[reaction.message_id][reaction.emoji] = {
        count: 0,
        user_reacted: false,
      };
    }

    reactionMap[reaction.message_id][reaction.emoji].count += 1;
    if (reaction.user_id === userId) {
      reactionMap[reaction.message_id][reaction.emoji].user_reacted = true;
    }
  });

  messageIds.forEach((id) => {
    result[id] = Object.entries(reactionMap[id]).map(([emoji, stats]) => ({
      emoji,
      count: stats.count,
      user_reacted: stats.user_reacted,
    }));
  });

  return result;
}

export async function getChatStats(): Promise<ChatRoomStats[]> {
  const supabase = createClient();

  const { data: rooms, error: roomsError } = await supabase
    .from('chat_rooms')
    .select('id, name, slug, type, emoji, color');

  if (roomsError) throw roomsError;

  const stats: ChatRoomStats[] = [];
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  for (const room of rooms || []) {
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('user_id, created_at')
      .eq('room_id', room.id);

    if (messagesError) throw messagesError;

    const totalMessages = messages?.length || 0;
    const activeUsers = new Set(messages?.map((m) => m.user_id) || []).size;
    const last24hMessages = messages?.filter(
      (m) => new Date(m.created_at) > new Date(twentyFourHoursAgo)
    ).length || 0;

    const { data: topUsers, error: topUsersError } = await supabase
      .from('chat_messages')
      .select('user_id, user_name')
      .eq('room_id', room.id)
      .limit(5);

    if (topUsersError) throw topUsersError;

    const userCounts: Record<string, number> = {};
    topUsers?.forEach((msg) => {
      userCounts[msg.user_id] = (userCounts[msg.user_id] || 0) + 1;
    });

    const topUsersList = Object.entries(userCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([userId]) => {
        const user = topUsers?.find((m: { user_id: string }) => m.user_id === userId);
        return {
          name: user?.user_name || 'Unknown',
          count: userCounts[userId],
        };
      });

    stats.push({
      room: {
        id: room.id,
        slug: room.slug,
        name: room.name,
        type: room.type as 'general' | 'team' | 'channel',
        emoji: room.emoji,
        color: room.color,
      },
      totalMessages,
      activeUsers,
      last24hMessages,
      topUsers: topUsersList,
    });
  }

  return stats;
}

// Like a message (toggle)
export async function toggleLike(
  messageId: string,
  userId: string
): Promise<{ liked: boolean; newCount: number }> {
  const supabase = createClient();

  // Check if already liked
  const { data: existing } = await supabase
    .from('chat_likes')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .single();

  if (existing) {
    // Unlike
    await supabase.from('chat_likes').delete().eq('id', existing.id);
    // Decrement count
    const { data: msg } = await supabase
      .from('chat_messages')
      .select('likes_count')
      .eq('id', messageId)
      .single();
    const newCount = Math.max((msg?.likes_count || 1) - 1, 0);
    await supabase
      .from('chat_messages')
      .update({ likes_count: newCount })
      .eq('id', messageId);
    return { liked: false, newCount };
  } else {
    // Like
    await supabase.from('chat_likes').insert([{ message_id: messageId, user_id: userId }]);
    // Increment count
    const { data: msg } = await supabase
      .from('chat_messages')
      .select('likes_count')
      .eq('id', messageId)
      .single();
    const newCount = (msg?.likes_count || 0) + 1;
    await supabase
      .from('chat_messages')
      .update({ likes_count: newCount })
      .eq('id', messageId);
    return { liked: true, newCount };
  }
}

// Get user's liked message IDs for a room
export async function getUserLikes(
  roomId: string,
  userId: string
): Promise<Set<string>> {
  const supabase = createClient();

  const { data } = await supabase
    .from('chat_likes')
    .select('message_id, chat_messages!inner(room_id)')
    .eq('user_id', userId)
    .eq('chat_messages.room_id', roomId);

  return new Set((data || []).map((d: any) => d.message_id));
}

// Get pinned messages for a room
export async function getPinnedMessages(roomId: string): Promise<ChatMessage[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('room_id', roomId)
    .eq('is_pinned', true)
    .order('likes_count', { ascending: false })
    .limit(3);

  if (error) throw error;
  return data || [];
}

// Toggle pin a message (admin function)
export async function togglePinMessage(messageId: string): Promise<boolean> {
  const supabase = createClient();

  const { data: msg } = await supabase
    .from('chat_messages')
    .select('is_pinned')
    .eq('id', messageId)
    .single();

  const newPinned = !(msg?.is_pinned);
  await supabase
    .from('chat_messages')
    .update({ is_pinned: newPinned })
    .eq('id', messageId);

  return newPinned;
}
