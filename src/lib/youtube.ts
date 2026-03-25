import { Video, ChannelStats } from '@/types';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// =============================================
// IN-MEMORY CACHE — Prevents excessive API calls
// Cache expires after 10 minutes
// =============================================
const cache = new Map<string, { data: Video[]; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function getCached(key: string): Video[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: Video[]): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// =============================================
// API FUNCTIONS
// =============================================
export async function searchChannelVideos(
  channelId: string,
  apiKey: string,
  maxResults: number = 6,
  query?: string
): Promise<Video[]> {
  const cacheKey = `channel:${channelId}:${maxResults}:${query || ''}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      part: 'snippet',
      channelId,
      maxResults: maxResults.toString(),
      order: 'date',
      type: 'video',
      key: apiKey,
    });

    if (query) {
      params.set('q', query);
    }

    const searchRes = await fetch(`${YOUTUBE_API_BASE}/search?${params}`);
    if (!searchRes.ok) throw new Error('YouTube API search failed');
    const searchData = await searchRes.json();

    const videoIds = searchData.items
      ?.map((item: any) => item.id?.videoId)
      .filter(Boolean)
      .join(',');

    if (!videoIds) return [];

    // Get video details for view counts and duration
    const detailsRes = await fetch(
      `${YOUTUBE_API_BASE}/videos?part=snippet,statistics,contentDetails,liveStreamingDetails&id=${videoIds}&key=${apiKey}`
    );
    const detailsData = await detailsRes.json();

    const videos: Video[] = (detailsData.items || []).map((item: any) => {
      const isLive = item.snippet?.liveBroadcastContent === 'live';
      return {
        id: item.id,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        channelId: item.snippet.channelId,
        thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || '',
        publishedAt: item.snippet.publishedAt,
        viewCount: isLive
          ? item.liveStreamingDetails?.concurrentViewers || item.statistics?.viewCount
          : item.statistics?.viewCount,
        duration: isLive ? 'CANLI' : parseDuration(item.contentDetails?.duration),
        url: `https://www.youtube.com/watch?v=${item.id}`,
        ytVideoId: item.id,
        live: isLive,
      };
    });

    setCache(cacheKey, videos);
    return videos;
  } catch (error) {
    console.error('YouTube API error:', error);
    return [];
  }
}

export async function getMultiChannelVideos(
  channelIds: string[],
  apiKey: string,
  maxPerChannel: number = 4
): Promise<Video[]> {
  const cacheKey = `multi:${channelIds.sort().join(',')}:${maxPerChannel}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const allVideos = await Promise.all(
    channelIds.map((id) => searchChannelVideos(id, apiKey, maxPerChannel))
  );

  const result = allVideos
    .flat()
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  setCache(cacheKey, result);
  return result;
}

// =============================================
// CHANNEL STATISTICS
// =============================================
const statsCache = new Map<string, { data: ChannelStats[]; timestamp: number }>();

export async function getChannelStats(
  channelIds: string[],
  apiKey: string
): Promise<ChannelStats[]> {
  const cacheKey = `stats:${channelIds.sort().join(',')}`;
  const cached = statsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const ids = channelIds.join(',');
    const res = await fetch(
      `${YOUTUBE_API_BASE}/channels?part=snippet,statistics&id=${ids}&key=${apiKey}`
    );
    if (!res.ok) throw new Error('YouTube Channels API failed');
    const data = await res.json();

    const stats: ChannelStats[] = (data.items || []).map((item: any) => ({
      channelId: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
      subscriberCount: item.statistics.subscriberCount || '0',
      viewCount: item.statistics.viewCount || '0',
      videoCount: item.statistics.videoCount || '0',
      publishedAt: item.snippet.publishedAt,
    }));

    statsCache.set(cacheKey, { data: stats, timestamp: Date.now() });
    return stats;
  } catch (error) {
    console.error('Channel stats error:', error);
    return [];
  }
}

function parseDuration(isoDuration?: string): string {
  if (!isoDuration) return '';
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '';

  const hours = match[1] ? `${match[1]}:` : '';
  const minutes = match[2] ? match[2].padStart(hours ? 2 : 1, '0') : '0';
  const seconds = match[3] ? match[3].padStart(2, '0') : '00';

  return `${hours}${minutes}:${seconds}`;
}

export function formatViewCount(count?: string): string {
  if (!count) return '';
  const num = parseInt(count);
  if (isNaN(num)) return count;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${Math.round(num / 1000)}K`;
  return count;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Az önce';
  if (diffHours < 24) return `${diffHours} saat önce`;
  if (diffDays < 7) return `${diffDays} gün önce`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} hafta önce`;
  return date.toLocaleDateString('tr-TR');
}
