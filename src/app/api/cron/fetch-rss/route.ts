import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// =============================================
// TÜM KANALLAR — Spor + Haber
// RSS feed'leri her 10 dakikada taranır.
// Bulunan yeni videolar videos tablosuna yazılır.
// Bu sayede YouTube API stale veri dönse bile
// sitede her zaman taze içerik gösterilir.
// =============================================
const ALL_CHANNEL_IDS = [
  // Spor kanalları
  'UCV1O-37iLics-xzEKk7C87w',  // 343 Digital
  'UCbsPbJOA35AhtXOseRO0JeA',  // Uğur Karakullukçu
  'UCvgwLFmnppZoPVBQJwPaNsA',  // Socrates Dergi
  'UCjQvcUBaLgccBFPhARlpyEg',  // Saha İçi
  'UCHowoDxzhyCPQBzhOpeP4-w',  // NOW Spor
  'UCPTceq23Pt1cHpJl-lIZS3Q',  // Eski Açık
  'UC4zFh-UMghh8zzTiZMOYVRQ',  // NEO Spor
  'UCFr6uAPwrG040QAWDKY0nnA',  // HTalks
  'UCHjbBVD4yRI7vU-S9Pwpnkw',  // Kontraspor
  'UCeCRRixprpBjNmzRWgLBiUA',  // VOLE
  'UCQZ-h2n7x5lGk1TfLwHPX2Q',  // Yağız Sabuncuoğlu
  'UCQpeujIamj2ZOKXZnrxTRhA',  // Galatasaray SK
  'UCuRJ7zpj8K51YTnUio20rTg',  // KAFA Sports
  'UC3JacAFC5mHH7bgTfLa8ceg',  // L1 Üçgen
  'UCmEgRY1A2263UXrQhjDuU0Q',  // Sports Digitale
  // Haber kanalları
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

async function fetchRSSVideos(channelId: string): Promise<RSSVideo[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZapTube/1.0)' },
        signal: controller.signal,
        cache: 'no-store', // Her zaman taze RSS al
      }
    );
    clearTimeout(timeout);
    if (!res.ok) return [];
    const xml = await res.text();

    const feedTitleMatch = xml.match(/<feed[^>]*>[\s\S]*?<title>([^<]+)<\/title>/);
    const channelTitle = feedTitleMatch
      ? feedTitleMatch[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
      : '';

    // Son 10 video al — daha geniş tarih aralığını yakala
    const entries = xml.split('<entry>').slice(1, 11);
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
          ? titleMatch[1]
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&#39;/g, "'")
              .replace(/&quot;/g, '"')
          : '',
        publishedAt: publishedMatch ? publishedMatch[1] : new Date().toISOString(),
        thumbnail: thumbMatch
          ? thumbMatch[1]
          : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      });
    }
    return videos;
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  // Cron secret koruması
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('secret') !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 500 }
    );
  }

  try {
    // 5'erli batch'ler halinde RSS çek — rate limit koruması
    const BATCH = 5;
    const allRSSVideos: RSSVideo[] = [];
    const channelResults: Record<string, number> = {};

    for (let i = 0; i < ALL_CHANNEL_IDS.length; i += BATCH) {
      const batch = ALL_CHANNEL_IDS.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map((ch) => fetchRSSVideos(ch))
      );
      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status === 'fulfilled' && r.value.length > 0) {
          allRSSVideos.push(...r.value);
          channelResults[batch[j]] = r.value.length;
        }
      }
      // Batch arası kısa bekleme
      if (i + BATCH < ALL_CHANNEL_IDS.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    if (allRSSVideos.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No RSS videos found from any channel',
      });
    }

    // Supabase'e yaz — RSS verisi (live kontrolü yapma, sadece kaydet)
    const supabase = createClient(supabaseUrl, supabaseKey);

    const videosToUpsert = allRSSVideos.map((v) => ({
      id: v.videoId,
      title: v.title,
      channelTitle: v.channelTitle,
      channelId: v.channelId,
      thumbnail: v.thumbnail,
      publishedAt: v.publishedAt,
      viewCount: '0',
      duration: '',
      durationSeconds: 0,
      url: `https://www.youtube.com/watch?v=${v.videoId}`,
      live: false, // RSS'ten canlı bilgisi yok, check-live ayrı güncelleyecek
    }));

    const { data: upsertCount, error } = await supabase.rpc(
      'bulk_upsert_videos',
      { p_videos: videosToUpsert }
    );

    if (error) {
      console.error('fetch-rss DB upsert error:', error);
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    const channelsWithVideos = Object.keys(channelResults).length;
    console.log(
      `fetch-rss: ${allRSSVideos.length} videos from ${channelsWithVideos}/${ALL_CHANNEL_IDS.length} channels`
    );

    return NextResponse.json({
      success: true,
      totalVideos: allRSSVideos.length,
      channelsWithVideos,
      totalChannels: ALL_CHANNEL_IDS.length,
      upsertCount,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('fetch-rss error:', e);
    return NextResponse.json(
      { success: false, message: String(e) },
      { status: 500 }
    );
  }
}
