export interface Channel {
  id: string;
  name: string;
  youtubeChannelId: string;
  description: string;
  thumbnail: string;
  teams: string[];
  contentTypes: string[];
  tags: string[];
  priority: number;
}

export interface Team {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

export interface ContentType {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

export interface Video {
  id: string;
  title: string;
  channelTitle: string;
  channelId: string;
  thumbnail: string;
  publishedAt: string;
  viewCount?: string;
  duration?: string;
  url: string;
  ytVideoId?: string;
  live?: boolean;
}

export interface ChannelData {
  channels: Channel[];
  teams: Team[];
  contentTypes: ContentType[];
}

// YouTube Channel Statistics
export interface ChannelStats {
  channelId: string;
  title: string;
  description: string;
  thumbnail: string;
  subscriberCount: string;
  viewCount: string;
  videoCount: string;
  publishedAt: string; // channel creation date
}

// User's channel preference (follow/favorite)
export interface UserChannelPreference {
  id: string;
  user_id: string;
  channel_id: string; // matches Channel.id
  is_following: boolean;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

// Chat System
export interface ChatRoom {
  id: string;
  slug: string;
  name: string;
  type: 'general' | 'team' | 'channel';
  emoji?: string;
  color?: string;
  created_at?: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  content: string;
  created_at: string;
  reactions?: ReactionCount[];
}

export interface ReactionCount {
  emoji: string;
  count: number;
  user_reacted: boolean;
}

export interface ChatRoomStats {
  room: ChatRoom;
  totalMessages: number;
  activeUsers: number;
  last24hMessages: number;
  topUsers: { name: string; count: number }[];
}

// Ad System
export interface SponsorData {
  id: string;
  name: string;
  image: string;
  link: string;
  slot: string;
  active: boolean;
}
