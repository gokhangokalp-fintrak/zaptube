import { Video, ChannelStats } from '@/types';
import { createClient } from '@/lib/supabase';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// =============================================
// 3-LEVEL CACHE SYSTEM
// L1: In-memory (instant, same session)
// L2: Supabase DB (persistent, survives restarts)
// L3: YouTube API (expensive, quota-limited)
// =============================================

// L1: In-memory cache
const videoCache = new Map<string, { data: Video[]; timestamp: number }>();
const VIDEO_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours — kota tasarrufu

// Uploads playlist ID cache (UC→UU conversion, NO API call needed!)
const uploadsPlaylistCache = new Map<string, string>();

// Channel stats cache
const statsCache = new Map<string, { data: ChannelStats[]; timestamp: number }>();
const STATS_CACHE_TTL = 8 * 60 * 60 * 1000; // 8 hours — kota tasarrufu

// =============================================
// L1: IN-MEMORY CACHE HELPERS
// =============================================
function getL1Cache(key: string): Video[] | null {
  const entry = videoCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > VIDEO_CACHE_TTL) {
    videoCache.delete(key);
    return null;
  }
  return entry.data;
}

function setL1Cache(key: string, data: Video[]): void {
  videoCache.set(key, { data, timestamp: Date.now() });
}

// =============================================
// L2: SUPABASE PERSISTENT CACHE
// =============================================
async function getL2Cache(key: string): Promise<Video[] | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('get_video_cache', { p_key: key });

    if (error || !data) return null;
    // Data might be a JSON string (double-stringify issue) or already parsed
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    // Supabase down or parse error? Fall through to YouTube API
    return null;
  }
}

async function setL2Cache(key: string, videos: Video[], ttlHours: number = 2): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.rpc('set_video_cache', {
      p_key: key,
      p_data: videos,
      p_ttl_hours: ttlHours,
    });
  } catch {
    // Cache write failed — not critical, just log
    console.warn('Supabase cache write failed for key:', key);
  }
}

// =============================================
// COMBINED CACHE: L1 → L2 → YouTube API
// =============================================
async function getCached(key: string): Promise<Video[] | null> {
  // L1: In-memory (instant)
  const l1 = getL1Cache(key);
  if (l1) return l1;

  // L2: Supabase (persistent)
  const l2 = await getL2Cache(key);
  if (l2) {
    // Promote to L1 for faster subsequent access
    setL1Cache(key, l2);
    return l2;
  }

  return null;
}

async function setCache(key: string, data: Video[], ttlHours: number = 2): Promise<void> {
  // Write to both levels
  setL1Cache(key, data);
  // Don't await — fire-and-forget to not slow down response
  setL2Cache(key, data, ttlHours).catch(() => {});
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
  const cached = await getCached(cacheKey);
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

    // Cache for 6 hours in both L1 + L2 — kota tasarrufu
    await setCache(cacheKey, videos, 6);
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
  const cached = await getCached(cacheKey);
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

    // Search results: cache 1 hour (shorter since search is specific)
    await setCache(cacheKey, videos, 1);
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
  const cached = await getCached(cacheKey);
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

  // Multi-channel cache: 6 hours — kota tasarrufu
  await setCache(cacheKey, sorted, 6);
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

  // Also check Supabase for stats
  try {
    const supabase = createClient();
    const { data: l2Data } = await supabase.rpc('get_video_cache', { p_key: cacheKey });
    if (l2Data) {
      const parsed = typeof l2Data === 'string' ? JSON.parse(l2Data) : l2Data;
      if (Array.isArray(parsed)) {
        statsCache.set(cacheKey, { data: parsed, timestamp: Date.now() });
        return parsed;
      }
    }
  } catch {
    // Supabase down, continue to API
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

    // L1 cache
    statsCache.set(cacheKey, { data: stats, timestamp: Date.now() });

    // L2 cache (12 hours) — fire-and-forget, kota tasarrufu
    try {
      const supabase2 = createClient();
      await supabase2.rpc('set_video_cache', {
        p_key: cacheKey,
        p_data: stats,
        p_ttl_hours: 12,
      });
    } catch {
      // Cache write failed, not critical
    }

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
