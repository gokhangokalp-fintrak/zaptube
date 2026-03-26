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
      const dur = parseDuration(item.contentDetails?.duration);
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
        duration: isLive ? 'CANLI' : dur.formatted,
        durationSeconds: isLive ? 0 : dur.seconds,
        url: `https://www.youtube.com/watch?v=${item.id}`,
        ytVideoId: item.id,
        live: isLive,
      };
    });

    // Saate göre akıllı cache — canlı yayınları kaçırmamak için prime time'da kısa
    // 02-10: 4 saat  — kimse video yüklemez, ölü saat
    // 10-17: 1 saat  — gündüz video yükleme aktif
    // 17-02: 15 dk   — prime time, canlı yayınları hemen yakala!
    const uploadHour = new Date().getHours();
    const uploadCacheTTL = (uploadHour >= 2 && uploadHour < 10) ? 4 : (uploadHour >= 10 && uploadHour < 17) ? 1 : 15 / 60;
    await setCache(cacheKey, videos, uploadCacheTTL);
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
      const dur = parseDuration(item.contentDetails?.duration);
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
        duration: isLive ? 'CANLI' : dur.formatted,
        durationSeconds: isLive ? 0 : dur.seconds,
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
// ⚡ LIVE STREAM DETECTION — KOTA DOSTU!
// Tek bir search çağrısı (100 birim) + saate göre akıllı cache
// 16 kanal için 16x100=1600 yerine sadece 100 birim!
//
// Cache süreleri (saat cinsinden):
// 02-10: 2 saat    — kimse yayın yapmaz
// 10-12: 0.5 saat  — nadir yayın
// 12-17: 0.25 saat — bazı kanallar başlar
// 17-20: 0.08 saat (~5dk) — maç öncesi yoğunluk
// 20-02: 0.05 saat (~3dk) — pik saat
// =============================================
function getLiveCacheTTL(): number {
  const hour = new Date().getHours();
  if (hour >= 2 && hour < 10) return 2;       // 2 saat — ölü saat
  if (hour >= 10 && hour < 12) return 0.5;     // 30 dk — nadir
  if (hour >= 12 && hour < 17) return 0.25;    // 15 dk — öğlen
  if (hour >= 17 && hour < 20) return 5 / 60;  // 5 dk — maç öncesi
  return 3 / 60;                                // 3 dk — pik saat (20-02)
}

async function fetchLiveStreams(
  channelIds: string[],
  apiKey: string
): Promise<Video[]> {
  const cacheKey = `live:all`;
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  try {
    // Geniş arama — tüm Türkçe futbol canlı yayınlarını yakala
    // q parametresini dar tutmak yerine geniş tutuyoruz ki
    // milli takım, Süper Lig, transfer, analiz hepsi yakalansın
    const params = new URLSearchParams({
      part: 'snippet',
      q: 'futbol',
      eventType: 'live',
      type: 'video',
      maxResults: '50',
      relevanceLanguage: 'tr',
      key: apiKey,
    });

    const res = await fetch(`${YOUTUBE_API_BASE}/search?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    const items = data.items || [];
    const cacheTTL = getLiveCacheTTL();
    if (items.length === 0) {
      // Boş sonucu da cache'le — gereksiz tekrar sorgu yapma
      await setCache(cacheKey, [], cacheTTL);
      return [];
    }

    // Filter: only keep videos from OUR channels
    const channelSet = new Set(channelIds);
    const ourItems = items.filter((item: any) =>
      channelSet.has(item.snippet?.channelId)
    );

    if (ourItems.length === 0) {
      await setCache(cacheKey, [], cacheTTL);
      return [];
    }

    // Get full details (1 birim per 50 videos — cheap!)
    const videoIds = ourItems.map((item: any) => item.id?.videoId).filter(Boolean).join(',');
    if (!videoIds) return [];

    const detailsRes = await fetch(
      `${YOUTUBE_API_BASE}/videos?` +
        new URLSearchParams({
          part: 'snippet,statistics,liveStreamingDetails',
          id: videoIds,
          key: apiKey,
        })
    );
    if (!detailsRes.ok) return [];
    const detailsData = await detailsRes.json();

    const liveVideos: Video[] = (detailsData.items || []).map((item: any) => ({
      id: item.id,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      channelId: item.snippet.channelId,
      thumbnail:
        item.snippet.thumbnails?.high?.url ||
        item.snippet.thumbnails?.medium?.url || '',
      publishedAt: item.snippet.publishedAt,
      viewCount: item.liveStreamingDetails?.concurrentViewers || item.statistics?.viewCount,
      duration: 'CANLI',
      url: `https://www.youtube.com/watch?v=${item.id}`,
      ytVideoId: item.id,
      live: true,
    }));

    // Akıllı cache — saate göre değişir (3dk pik, 2 saat gece)
    await setCache(cacheKey, liveVideos, cacheTTL);
    return liveVideos;
  } catch (error) {
    console.error('fetchLiveStreams error:', error);
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

  // Fetch uploads AND live streams in parallel
  const [uploadsResults, liveVideos] = await Promise.all([
    Promise.allSettled(
      channelIds.map((id) => fetchChannelUploads(id, apiKey, maxPerChannel))
    ),
    fetchLiveStreams(channelIds, apiKey),
  ]);

  const allVideos: Video[] = [];

  // Add live streams first (they should appear at top)
  allVideos.push(...liveVideos);

  // Add uploads
  uploadsResults.forEach((result) => {
    if (result.status === 'fulfilled') {
      allVideos.push(...result.value);
    }
  });

  // Deduplicate — live streams might also appear in uploads
  const seen = new Set<string>();
  const deduped = allVideos.filter((v) => {
    const key = v.ytVideoId || v.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort: live first, then by date
  const sorted = deduped.sort((a, b) => {
    if (a.live && !b.live) return -1;
    if (!a.live && b.live) return 1;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  // Akıllı multi-channel cache
  // Canlı varsa: live cache TTL (3dk pik, 5dk akşam vb.)
  // Canlı yoksa: kısa cache — canlı başlarsa hemen yakalansın!
  // Gece ölü saatlerde uzun, prime time'da kısa
  const hasLive = sorted.some(v => v.live);
  const multiHour = new Date().getHours();
  const noLiveTTL = (multiHour >= 2 && multiHour < 10) ? 2        // 2 saat — gece ölü saat
    : (multiHour >= 10 && multiHour < 17) ? 15 / 60               // 15 dk — gündüz
    : 5 / 60;                                                       // 5 dk — prime time (17-02)
  await setCache(cacheKey, sorted, hasLive ? getLiveCacheTTL() : noLiveTTL);
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
function parseDuration(isoDuration?: string): { formatted: string; seconds: number } {
  if (!isoDuration) return { formatted: '', seconds: 0 };
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return { formatted: '', seconds: 0 };

  const h = parseInt(match[1] || '0');
  const m = parseInt(match[2] || '0');
  const s = parseInt(match[3] || '0');
  const totalSeconds = h * 3600 + m * 60 + s;

  const hours = h ? `${h}:` : '';
  const minutes = String(m).padStart(hours ? 2 : 1, '0');
  const seconds2 = String(s).padStart(2, '0');

  return { formatted: `${hours}${minutes}:${seconds2}`, seconds: totalSeconds };
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
