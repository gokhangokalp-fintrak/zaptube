import { Video, ChannelStats } from '@/types';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// =============================================
// MULTI-LEVEL CACHE SYSTEM
// DiziKolik-style: Aggressive caching to prevent quota burn
// =============================================

// Level 1: In-memory cache (instant, survives within session)
const videoCache = new Map<string, { data: Video[]; timestamp: number }>();
const VIDEO_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 HOURS (was 10 min!)

// Level 2: Uploads playlist ID cache (UC→UU conversion, NO API call needed!)
const uploadsPlaylistCache = new Map<string, string>();

// Level 3: Channel stats cache
const statsCache = new Map<string, { data: ChannelStats[]; timestamp: number }>();
const STATS_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours for stats

// =============================================
// CACHE HELPERS
// =============================================
function getCached(key: string): Video[] | null {
  const entry = videoCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > VIDEO_CACHE_TTL) {
    videoCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: Video[]): void {
  videoCache.set(key, { data, timestamp: Date.now() });
}

// =============================================
// ⚡ SMART PLAYLIST DERIVATION — NO API CALL!
// YouTube rule: uploads playlist = "UU" + channelId.substring(2)
// This saves 1 API credit per channel every time!
// =============================================
function getUploadsPlaylistId(channelId: string): string {
  if (uploadsPlaylistCache.has(channelId)) {
    return uploadsPlaylistCache.get(channelId)!;
  }

  // UC... → UU... conversion (YouTube's built-in format rule)
  const playlistId = channelId.startsWith('UC')
    ? 'UU' + channelId.substring(2)
    : channelId;

  uploadsPlaylistCache.set(channelId, playlistId);
  return playlistId;
}

// =============================================
// ⚡ QUOTA-EFFICIENT: Use playlistItems instead of search!
// search.list = 100 units per call
// playlistItems.list = 1 unit per call (100x cheaper!)
// =============================================
async function fetchChannelUploads(
  channelId: string,
  apiKey: string,
  maxResults: number = 6
): Promise<Video[]> {
  const cacheKey = `uploads:${channelId}:${maxResults}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    // Step 1: Get uploads playlist ID (NO API call — just string conversion!)
    const playlistId = getUploadsPlaylistId(channelId);

    // Step 2: Fetch playlist items (1 unit instead of 100!)
    const playlistRes = await fetch(
      `${YOUTUBE_API_BASE}/playlistItems?` +
        new URLSearchParams({
          part: 'snippet,status',
          playlistId,
          maxResults: maxResults.toString(),
          key: apiKey,
        })
    );

    if (!playlistRes.ok) {
      console.error(`PlaylistItems failed for ${channelId}:`, playlistRes.status);
      return [];
    }

    const playlistData = await playlistRes.json();
    const items = playlistData.items || [];

    if (items.length === 0) return [];

    // Step 3: Get video details for statistics + live info
    // Batch all IDs into ONE call (saves quota!)
    const videoIds = items
      .map((item: any) => item.snippet?.resourceId?.videoId)
      .filter(Boolean)
      .join(',');

    if (!videoIds) return [];

    const detailsRes = await fetch(
      `${YOUTUBE_API_BASE}/videos?` +
        new URLSearchParams({
          part: 'snippet,statistics,contentDetails,liveStreamingDetails',
          id: videoIds,
          key: apiKey,
        })
    );

    if (!detailsRes.ok) {
      console.error('Video details failed:', detailsRes.status);
      return [];
    }

    const detailsData = await detailsRes.json();

    const videos: Video[] = (detailsData.items || []).map((item: any) => {
      const isLive = item.snippet?.liveBroadcastContent === 'live';
      return {
        id: item.id,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        channelId: item.snippet.channelId,
        thumbnail:
          item.snippet.thumbnails?.high?.url ||
          item.snippet.thumbnails?.medium?.url ||
          '',
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

    // Cache for 2 hours!
    setCache(cacheKey, videos);
    return videos;
  } catch (error) {
    console.error('fetchChannelUploads error:', error);
    return [];
  }
}

// =============================================
// FALLBACK: Original search method (expensive! 100 units)
// Only used if playlist method fails
// =============================================
export async function searchChannelVideos(
  channelId: string,
  apiKey: string,
  maxResults: number = 6,
  query?: string
): Promise<Video[]> {
  // If no search query, use the cheap playlist method!
  if (!query) {
    return fetchChannelUploads(channelId, apiKey, maxResults);
  }

  // Search is only used when user explicitly searches (rare)
  const cacheKey = `search:${channelId}:${maxResults}:${query}`;
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
        thumbnail:
          item.snippet.thumbnails?.high?.url ||
          item.snippet.thumbnails?.medium?.url ||
          '',
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
    console.error('YouTube API search error:', error);
    return [];
  }
}

// =============================================
// MULTI-CHANNEL: Parallel fetch with smart caching
// =============================================
export async function getMultiChannelVideos(
  channelIds: string[],
  apiKey: string,
  maxPerChannel: number = 4
): Promise<Video[]> {
  const cacheKey = `multi:${channelIds.sort().join(',')}:${maxPerChannel}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Use Promise.allSettled to prevent cascade failures
  const results = await Promise.allSettled(
    channelIds.map((id) => fetchChannelUploads(id, apiKey, maxPerChannel))
  );

  const allVideos: Video[] = [];
  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      allVideos.push(...result.value);
    }
  });

  const sorted = allVideos.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  setCache(cacheKey, sorted);
  return sorted;
}

// =============================================
// CHANNEL STATISTICS (batched, cached 4 hours)
// =============================================
export async function getChannelStats(
  channelIds: string[],
  apiKey: string
): Promise<ChannelStats[]> {
  const cacheKey = `stats:${channelIds.sort().join(',')}`;
  const cached = statsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < STATS_CACHE_TTL) {
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
      thumbnail:
        item.snippet.thumbnails?.medium?.url ||
        item.snippet.thumbnails?.default?.url ||
        '',
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

// =============================================
// HELPERS
// =============================================
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
