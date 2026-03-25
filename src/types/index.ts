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
}

export interface ChannelData {
  channels: Channel[];
  teams: Team[];
  contentTypes: ContentType[];
}
