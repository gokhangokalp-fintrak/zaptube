import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Haber kanalları — 7/24 canlı yayın yapanlar
const HABER_CHANNEL_IDS = [
  'UCV6zcRug6Hqp1UX_FdyUeBg',  // CNN Türk
  'UCtc-a9ZUIg0_5HpsPxEO7Qg',  // Haber Global
  'UCBgTP2LOFVPmq15W-RH-WXA',  // TRT Haber
  'UCApLxl6oYQafxvykuoC2uxQ',  // Bloomberg HT
  'UCOulx_rep5O4i9y6AyDqVvw',  // Sözcü TV
  'UCn6dNfiRE_Xunu7iMyvD7AA',  // Habertürk TV
  'UCndsdUW_oPLqpQJY9J8oIRg',  // TV100
  'UCf_ResXZzE-o18zACUEmyvQ',  // Halk TV
];

interface RSSVideo {
  videoId: string;
  channelId: string;
  channelTitle: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
}

// =============================================
// 1. RSS'ten video ID'leri al (ÜCRETSİZ, kota yemez)
// =============================================
async function fetchRSSVideoIds(channelId: string): Promise<RSSVideo[]> {
  try {
    const res = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZapTube/1.0)' } }
    );
    if (!res.ok) return [];
    const xml = await res.text();

    const feedTitleMatch = xml.match(/<feed[^>]*>[\s\S]*?<title>([^<]+)<\/title>/);
    const channelTitle = feedTitleMatch
      ? feedTitleMatch[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
      : '';

    const entries = xml.split('<entry>').slice(1, 6); // Son 5 video yeterli
    const videos: RSSVideo[] = [];

    for (const entry of entries) {
      const videoIdMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
      const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
      const thumbMatch = entry.match(/<media:thumbnail url="([^"]+)"/);
      if (!videoIdMatch) continue;

      const videoId = videoIdMatch[1];
      videos.push({
        videoId,
        channelId,
        channelTitle,
        title: titleMatch
          ? titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
          : '',
        publishedAt: publishedMatch ? publishedMatch[1] : new Date().toISOString(),
        thumbnail: thumbMatch ? thumbMatch[1] : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      });
    }
    return videos;
  } catch {
    return [];
  }
}

// =============================================
// 2. YouTube API ile canlı yayın kontrolü
//    videos.list → part=liveStreamingDetails
//    50 video = 1 birim kota (çok ucuz!)
// =============================================
async function checkLiveStatus(
  videoIds: string[],
  apiKey: string
): Promise<Map<string, { isLive: boolean; liveTitle?: string }>> {
  const result = new Map<string, { isLive: boolean; liveTitle?: string }>();

  // 50'lik batch'ler halinde kontrol et
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${batch.join(',')}&key=${apiKey}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`YouTube API error: ${res.status}`);
        continue;
      }
      const data = await res.json();

      for (const item of data.items || []) {
        const isLive = item.snippet?.liveBroadcastContent === 'live';
        result.set(item.id, {
          isLive,
          liveTitle: isLive ? item.snippet?.title : undefined,
        });
      }
    } catch (e) {
      console.error('YouTube API fetch error:', e);
    }
  }

  return result;
}

// =============================================
// CRON ENDPOINT — Vercel cron veya manual çağrı
// Her sabah 8:00 TR (05:00 UTC) çalışır
// =============================================
export async function GET(request: NextRequest) {
  // Cron secret koruması (opsiyonel)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Manuel çağrı da izin ver (query param ile)
    const { searchParams } = new URL(request.url);
    if (searchParams.get('secret') !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const apiKey = process.env.YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  try {
    // 1. RSS'ten tüm haber kanalı videolarını al (ücretsiz)
    const rssResults = await Promise.allSettled(
      HABER_CHANNEL_IDS.map(ch => fetchRSSVideoIds(ch))
    );

    const allRSSVideos: RSSVideo[] = [];
    for (const result of rssResults) {
      if (result.status === 'fulfilled') {
        allRSSVideos.push(...result.value);
      }
    }

    if (allRSSVideos.length === 0) {
      return NextResponse.json({ success: false, message: 'No RSS videos found' });
    }

    // 2. YouTube API ile canlı yayın kontrolü (~1-2 birim kota)
    const videoIds = allRSSVideos.map(v => v.videoId);
    const liveStatus = await checkLiveStatus(videoIds, apiKey);

    // 3. Supabase'e yaz — canlı yayınları işaretle
    const supabase = createClient(supabaseUrl, supabaseKey);

    const videosToUpsert = allRSSVideos.map(v => ({
      id: v.videoId,
      title: liveStatus.get(v.videoId)?.liveTitle || v.title,
      channelTitle: v.channelTitle,
      channelId: v.channelId,
      thumbnail: v.thumbnail,
      publishedAt: v.publishedAt,
      viewCount: '0',
      duration: '',
      durationSeconds: 0,
      url: `https://www.youtube.com/watch?v=${v.videoId}`,
      live: liveStatus.get(v.videoId)?.isLive || false,
    }));

    const { error } = await supabase.rpc('bulk_upsert_videos', {
      p_videos: videosToUpsert,
    });

    if (error) {
      console.error('DB upsert error:', error);
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    // Sonuç özeti
    const liveCount = videosToUpsert.filter(v => v.live).length;
    const liveChannels = Array.from(new Set(videosToUpsert.filter(v => v.live).map(v => v.channelTitle)));

    return NextResponse.json({
      success: true,
      totalChecked: allRSSVideos.length,
      liveCount,
      liveChannels,
      quotaUsed: Math.ceil(videoIds.length / 50), // birim
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('check-live error:', e);
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}
