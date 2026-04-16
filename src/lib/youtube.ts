import { Video, ChannelStats } from '@/types';
import { createClient } from '@/lib/supabase';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// =============================================
// CACHE VERSION — Deployment değişince eski cache geçersiz olur
// Vercel her deployment'ta VERCEL_GIT_COMMIT_SHA verir.
// Cache key'e eklenerek eski lambda'nın yazdığı stale veri
// yeni deployment tarafından otomatik olarak reddedilir.
// =============================================
const DEPLOY_SHA = (process.env.VERCEL_GIT_COMMIT_SHA || 'dev').substring(0, 8);
function versionedKey(key: string): string {
  return `${DEPLOY_SHA}:${key}`;
}

// =============================================
// 3-LEVEL CACHE SYSTEM
// L1: In-memory (instant, same session)
// L2: Supabase DB (persistent, survives restarts)
// L3: YouTube API (expensive, quota-limited)
// =============================================

// L1: In-memory cache
const videoCache = new Map<string, { data: Video[]; timestamp: number }>();
// L1 TTL saate göre dinamik — getL1TTL() ile hesaplanır
function getL1TTL(): number {
  const hour = new Date().getHours();
  if (hour >= 2 && hour < 10) return 30 * 60 * 1000;  // Gece: 30 dk
  if (hour >= 10 && hour < 17) return 5 * 60 * 1000;   // Gündüz: 5 dk
  return 3 * 60 * 1000;                                  // Prime time: 3 dk
}

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
  if (Date.now() - entry.timestamp > getL1TTL()) {
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
    // Versiyonlu key — eski deployment'ın cache'ini okumaz
    const { data, error } = await supabase.rpc('get_video_cache', { p_key: versionedKey(key) });

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
    // Versiyonlu key — bu deployment'a özel
    await supabase.rpc('set_video_cache', {
      p_key: versionedKey(key),
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

// Stale cache fallback — süresi dolmuş multi-channel veriyi getir
// Kota aşımında boş ekran yerine eski veriyi göster
async function getStaleCacheFallback(keyPrefix: string): Promise<Video[] | null> {
  try {
    const supabase = createClient();
    // Versiyonlu prefix — sadece bu deployment'ın verisini ara
    const { data, error } = await supabase
      .from('video_cache')
      .select('data')
      .like('cache_key', `${DEPLOY_SHA}:${keyPrefix}%`)
      .order('expires_at', { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      const row = data[0];
      const parsed = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log(`Using stale multi-channel cache (${parsed.length} videos)`);
        return parsed;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Fallback cache: uploads için farklı maxResults ile cache'de veri ara
// Örn: uploads:channelId:4 miss ama uploads:channelId:2 var → onu kullan
// KRİTİK: Önce geçerli cache dene, bulamazsa SÜRESİ DOLMUŞ veriyi de dön!
// Boş ekran göstermektense eski veri göstermek her zaman daha iyi.
async function getUploadsCacheFallback(channelId: string): Promise<Video[] | null> {
  try {
    const supabase = createClient();

    // 1. Önce süresi dolmamış cache dene (versiyonlu key)
    const { data, error } = await supabase
      .from('video_cache')
      .select('data')
      .like('cache_key', `${DEPLOY_SHA}:uploads:${channelId}:%`)
      .gt('expires_at', new Date().toISOString())
      .limit(1);

    if (!error && data && data.length > 0) {
      const row = data[0];
      const parsed = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }

    // 2. Süresi dolmuş eski veriyi de kabul et — boş ekran göstermektense!
    // Versiyon prefix'siz ara — herhangi bir deployment'ın verisini kabul et
    const { data: staleData, error: staleError } = await supabase
      .from('video_cache')
      .select('data')
      .like('cache_key', `%uploads:${channelId}:%`)
      .order('expires_at', { ascending: false })
      .limit(1);

    if (!staleError && staleData && staleData.length > 0) {
      const row = staleData[0];
      const parsed = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log(`Using STALE cache for ${channelId} (expired but better than empty)`);
        return parsed;
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function setCache(key: string, data: Video[], ttlHours: number = 2): Promise<void> {
  // Write to both levels
  setL1Cache(key, data);
  // Don't await — fire-and-forget to not slow down response
  setL2Cache(key, data, ttlHours).catch(() => {});
}

// =============================================
// RSS FEED — ÜCRETSİZ VİDEO ID KAYNAĞI
// YouTube playlistItems API bazen stale veri döndürebilir.
// RSS feed her zaman güncel — kota yemez, hızlı!
// playlistItems'tan gelen ID'lerle merge edilerek
// her zaman en taze videoları yakalarız.
// =============================================
async function fetchRSSVideoIds(channelId: string): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZapTube/1.0)' },
        signal: controller.signal,
        cache: 'no-store', // Next.js fetch cache'ini devre dışı bırak — her zaman taze RSS
      }
    );
    clearTimeout(timeout);
    if (!res.ok) return [];
    const xml = await res.text();
    const ids: string[] = [];
    const regex = /<yt:videoId>([^<]+)<\/yt:videoId>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      ids.push(match[1]);
    }
    return ids; // En son 15 video (YouTube RSS varsayılanı)
  } catch {
    return []; // Timeout veya hata — sessizce devam
  }
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
        }),
      { cache: 'no-store' } // Next.js fetch cache devre dışı
    );

    if (!playlistRes.ok) {
      const errorBody = await playlistRes.text().catch(() => '');
      console.error(`PlaylistItems failed for ${channelId}: status=${playlistRes.status} body=${errorBody.substring(0, 200)}`);
      // API hata verdi — cache'de eski veri varsa onu dön ama _stale işaretle
      const fallback = await getUploadsCacheFallback(channelId);
      if (fallback) {
        return fallback.map(v => ({ ...v, _fromStaleCache: true } as any));
      }
      return [];
    }

    const playlistData = await playlistRes.json();
    const items = playlistData.items || [];

    // Step 2.5: RSS feed'den de video ID'leri al (ÜCRETSİZ!)
    // playlistItems API bazen stale veri döndürebilir,
    // RSS her zaman güncel. İkisini merge edip en taze listeyi oluştur.
    const playlistVideoIds: string[] = items
      .map((item: any) => item.snippet?.resourceId?.videoId)
      .filter(Boolean);

    const rssVideoIds = await fetchRSSVideoIds(channelId);

    // Merge: önce playlist ID'leri, sonra RSS'ten gelip playlist'te olmayanlar
    const mergedIdSet = new Set(playlistVideoIds);
    for (const rssId of rssVideoIds) {
      mergedIdSet.add(rssId);
    }
    const allVideoIds = Array.from(mergedIdSet);

    if (allVideoIds.length === 0) return [];

    if (rssVideoIds.length > 0 && rssVideoIds.some(id => !playlistVideoIds.includes(id))) {
      console.log(`RSS found ${rssVideoIds.filter(id => !playlistVideoIds.includes(id)).length} extra videos for ${channelId} not in playlistItems`);
    }

    // Step 3: Get video details for statistics + live info
    // Batch all IDs into ONE call (saves quota!)
    const videoIds = allVideoIds.join(',');

    const detailsRes = await fetch(
      `${YOUTUBE_API_BASE}/videos?` +
        new URLSearchParams({
          part: 'snippet,statistics,contentDetails,liveStreamingDetails',
          id: videoIds,
          key: apiKey,
        }),
      { cache: 'no-store' } // Next.js fetch cache devre dışı
    );

    if (!detailsRes.ok) {
      console.error('Video details failed:', detailsRes.status);
      const fallback = await getUploadsCacheFallback(channelId);
      if (fallback) {
        return fallback.map(v => ({ ...v, _fromStaleCache: true } as any));
      }
      return [];
    }

    const detailsData = await detailsRes.json();

    const videos: Video[] = (detailsData.items || []).map((item: any) => {
      // Gerçek canlı yayın tespiti:
      // 1. liveBroadcastContent === 'live' VE
      // 2. actualEndTime YOKSA (yayın bitmemiş) VE
      // 3. actualStartTime VARSA (yayın başlamış)
      // Bu 3 koşul bitmiş eski yayınların "CANLI" gösterilmesini engeller.
      const lbc = item.snippet?.liveBroadcastContent;
      const lsd = item.liveStreamingDetails;
      const isLive = lbc === 'live' && !lsd?.actualEndTime && !!lsd?.actualStartTime;
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
          ? lsd?.concurrentViewers || item.statistics?.viewCount
          : item.statistics?.viewCount,
        duration: isLive ? 'CANLI' : dur.formatted,
        durationSeconds: isLive ? 0 : dur.seconds,
        url: `https://www.youtube.com/watch?v=${item.id}`,
        ytVideoId: item.id,
        live: isLive,
      };
    });

    // Boş sonucu cache'leme — API hatası olabilir, sonraki poll tekrar denesin
    if (videos.length === 0) return videos;

    // Saate göre akıllı cache — canlı yayınları kaçırmamak için prime time'da kısa
    // 02-10: 2 saat  — kimse video yüklemez, ölü saat
    // 10-17: 30 dk   — gündüz video yükleme aktif
    // 17-02: 15 dk   — prime time, canlı yayınları hemen yakala!
    const uploadHour = new Date().getHours();
    const uploadCacheTTL = (uploadHour >= 2 && uploadHour < 10) ? 2 : (uploadHour >= 10 && uploadHour < 17) ? 0.5 : 15 / 60;
    await setCache(cacheKey, videos, uploadCacheTTL);
    return videos;
  } catch (error) {
    console.error('fetchChannelUploads error:', error);
    // API hata verdi — cache'de farklı key ile eski veri varsa onu dön ama _stale işaretle
    const fallback = await getUploadsCacheFallback(channelId);
    if (fallback && fallback.length > 0) {
      console.log(`Using fallback cache for ${channelId} (${fallback.length} videos)`);
      return fallback.map(v => ({ ...v, _fromStaleCache: true } as any));
    }
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

    const searchRes = await fetch(`${YOUTUBE_API_BASE}/search?${params}`, { cache: 'no-store' });
    if (!searchRes.ok) throw new Error('YouTube API search failed');
    const searchData = await searchRes.json();

    const videoIds = searchData.items
      ?.map((item: any) => item.id?.videoId)
      .filter(Boolean)
      .join(',');

    if (!videoIds) return [];

    const detailsRes = await fetch(
      `${YOUTUBE_API_BASE}/videos?part=snippet,statistics,contentDetails,liveStreamingDetails&id=${videoIds}&key=${apiKey}`,
      { cache: 'no-store' }
    );
    const detailsData = await detailsRes.json();

    const videos: Video[] = (detailsData.items || []).map((item: any) => {
      // Gerçek canlı yayın tespiti (fetchChannelUploads ile aynı mantık)
      const lbc = item.snippet?.liveBroadcastContent;
      const lsd = item.liveStreamingDetails;
      const isLive = lbc === 'live' && !lsd?.actualEndTime && !!lsd?.actualStartTime;
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
          ? lsd?.concurrentViewers || item.statistics?.viewCount
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
// KOTA HESABI (server-side, tüm kullanıcılar ortak):
// search.list KALDIRILDI — artık 0 birim!
// Canlı yayın tespiti fetchChannelUploads içinde yapılıyor.
// playlistItems.list (1 birim) + videos.list (1 birim) = 2 birim/kanal
//
// 15 kanal × 2 birim = 30 birim per yenileme
// 02-10: 2 saat cache  →  4 yenileme × 30 =  120 birim
// 10-17: 1 saat cache  →  7 yenileme × 30 =  210 birim
// 17-02: 15 dk cache   → 36 yenileme × 30 = 1.080 birim
//
// GÜNLÜK TOPLAM:                             ~1.410 birim/gün ✅
// (10K kotanın %14'ü — çok güvenli!)
function getLiveCacheTTL(): number {
  const hour = new Date().getHours();
  if (hour >= 2 && hour < 10) return 2;        // 2 saat — ölü saat
  if (hour >= 10 && hour < 17) return 0.5;      // 30 dk — gündüz
  if (hour >= 17 && hour < 20) return 0.25;     // 15 dk — maç öncesi
  return 10 / 60;                                // 10 dk — pik saat (20-02)
}

// =============================================
// fetchLiveStreams KALDIRILDI!
// Canlı yayın tespiti artık fetchChannelUploads içinde yapılıyor.
// videos.list zaten liveBroadcastContent === 'live' döndürüyor.
// maxResults artırıldı (10) — canlı yayınları kaçırmamak için.
// Bu sayede search.list çağrısı YOK → günde 0 birim tasarruf!
// =============================================

// =============================================
// MULTI-CHANNEL: Parallel fetch with smart caching
// =============================================
export async function getMultiChannelVideos(
  channelIds: string[],
  apiKey: string,
  maxPerChannel: number = 4
): Promise<Video[]> {
  const cacheKey = `multi:${channelIds.sort().join(',')}:${maxPerChannel}`;
  // Multi-channel sonucu SADECE L1 (in-memory) cache'te tut!
  // L2 (Supabase) cache yazılmıyor çünkü:
  // 1. Bireysel kanal cache'leri zaten L2'de — her kanal bağımsız tazeleşir
  // 2. Multi-channel L2 cache, bir kanal güncellendiğinde diğerlerini de eski tutuyor
  // 3. L1 cache lambda ömrüyle sınırlı — cold start = taze veri
  const l1 = getL1Cache(cacheKey);
  if (l1) return l1;

  // Kanalları küçük gruplar halinde çek — YouTube rate limit'e takılmamak için
  // 23 kanalı aynı anda çekmek yerine 5'erli batch'ler halinde çek
  const fetchCount = Math.max(maxPerChannel, 10); // en az 10 video çek
  const BATCH_SIZE = 5;
  const uploadsResults: PromiseSettledResult<Video[]>[] = [];
  for (let i = 0; i < channelIds.length; i += BATCH_SIZE) {
    const batch = channelIds.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map((id) => fetchChannelUploads(id, apiKey, fetchCount))
    );
    uploadsResults.push(...batchResults);
    // Batch'ler arası kısa bekleme — rate limit koruması
    if (i + BATCH_SIZE < channelIds.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const allVideos: Video[] = [];

  // Add uploads (live ones already marked with live: true)
  uploadsResults.forEach((result) => {
    if (result.status === 'fulfilled') {
      allVideos.push(...result.value);
    }
  });

  // Stale fallback verilerini ayır — bunlar cache'e yazılmamalı
  const hasStaleData = allVideos.some((v: any) => v._fromStaleCache);

  // _fromStaleCache işaretini temizle (client'a gitmemeli)
  const cleanVideos = allVideos.map((v: any) => {
    const { _fromStaleCache, ...clean } = v;
    return clean as Video;
  });

  // Deduplicate — live streams might also appear in uploads
  const seen = new Set<string>();
  const deduped = cleanVideos.filter((v) => {
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

  // KRİTİK: Boş sonucu ASLA cache'leme!
  if (sorted.length === 0) {
    // SON ÇARE: Süresi dolmuş eski cache'den veri getir
    const stale = await getStaleCacheFallback(`multi:`);
    if (stale && stale.length > 0) {
      console.log(`All APIs failed, using stale cache (${stale.length} videos)`);
      return stale;
    }
    return sorted;
  }

  // KRİTİK: Stale fallback verisi içeren sonuçları CACHE'LEME!
  // Yoksa eski veri sürekli geri döngüye giriyor.
  if (hasStaleData) {
    console.warn(`Multi-channel result contains stale fallback data — NOT caching to prevent stale loop`);
    return sorted;
  }

  // Multi-channel sonucu SADECE L1 cache'e yaz (L2 yok!)
  // Bireysel kanallar zaten L2'de cache'li — multi-channel L2 gereksiz katman
  // L1 TTL 15 dk — lambda ölünce cache gider, sonraki istek taze veri alır
  setL1Cache(cacheKey, sorted);
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
