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
