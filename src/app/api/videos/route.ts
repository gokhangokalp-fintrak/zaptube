import { NextRequest, NextResponse } from 'next/server';
import { searchChannelVideos, getMultiChannelVideos } from '@/lib/youtube';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic'; // Her zaman sunucuda çalışsın

// =============================================
// FALLBACK: Supabase "videos" tablosundan serve et
// YouTube API kota aşımı veya hata durumunda devreye girer.
// Bu tablo RSS feed'lerden dolduruluyor (Edge Function: fetch-rss-videos)
// Videolar ASLA silinmez — en az 1 haftalık arşiv her zaman mevcut.
// =============================================
async function getVideosFromDB(channelIds: string[], limit: number = 60): Promise<any[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('get_channel_videos', {
      p_channel_ids: channelIds,
      p_limit: limit,
    });
    if (error || !data) return [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// YouTube API'den gelen videoları kalıcı tabloya yaz (fire-and-forget)
// Bu sayede her başarılı fetch arşivi büyütür
async function saveVideosToDB(videos: any[]): Promise<void> {
  try {
    if (!videos || videos.length === 0) return;
    const supabase = createClient();
    await supabase.rpc('bulk_upsert_videos', { p_videos: videos });
  } catch {
    // Kritik değil — sessizce devam et
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const channelIds = searchParams.get('channelIds')?.split(',').filter(Boolean) || [];
  const query = searchParams.get('q') || undefined;
  const maxResults = parseInt(searchParams.get('max') || '4');

  // Server-side only — API key tarayıcıya asla gitmez
  const apiKey = process.env.YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'YouTube API key is not configured', videos: [] },
      { status: 500 }
    );
  }

  if (channelIds.length === 0) {
    return NextResponse.json({ videos: [] });
  }

  try {
    let videos;
    if (channelIds.length === 1) {
      videos = await searchChannelVideos(channelIds[0], apiKey, maxResults, query);
    } else {
      videos = await getMultiChannelVideos(channelIds, apiKey, maxResults);
    }

    // =============================================
    // MERGE: YouTube API + Supabase videos tablosu
    // YouTube playlistItems API bazen stale veri döndürebilir.
    // RSS cron tabanlı videos tablosu daha güncel olabilir.
    // Her iki kaynağı merge edip en taze listeyi oluştur.
    // =============================================
    if (!videos || videos.length === 0) {
      console.log('YouTube API returned empty, falling back to videos DB table');
      videos = await getVideosFromDB(channelIds, maxResults * channelIds.length);
    } else {
      // Başarılı fetch → arşive kaydet (fire-and-forget, response'u yavaşlatmaz)
      saveVideosToDB(videos).catch(() => {});

      // DB'den de al ve merge et — RSS cron daha taze veri bulmuş olabilir
      try {
        const dbVideos = await getVideosFromDB(channelIds, maxResults * channelIds.length);
        if (dbVideos && dbVideos.length > 0) {
          // API'dan gelen video ID'leri
          const apiIdSet = new Set(videos.map((v: any) => v.id || v.ytVideoId));
          // DB'de olup API'da olmayan yeni videoları ekle
          const extraVideos = dbVideos.filter((dbv: any) => !apiIdSet.has(dbv.id));
          if (extraVideos.length > 0) {
            console.log(`DB merge: found ${extraVideos.length} extra videos from RSS cron not in YouTube API`);
            videos = [...videos, ...extraVideos];
            // Merge sonrası yeniden sırala: live first, then by date
            videos.sort((a: any, b: any) => {
              if (a.live && !b.live) return -1;
              if (!a.live && b.live) return 1;
              const dateA = new Date(a.publishedAt || a.published_at || 0).getTime();
              const dateB = new Date(b.publishedAt || b.published_at || 0).getTime();
              return dateB - dateA;
            });
          }
        }
      } catch {
        // DB merge başarısız — YouTube API verisi yeterli
      }
    }

    // Cache header: CDN ve tarayıcı cache — gereksiz API çağrılarını azaltır
    // s-maxage: Vercel Edge cache süresi
    // stale-while-revalidate: arka planda yenilerken eski veriyi göster
    const hour = new Date().getHours();
    // Edge CDN cache — kullanıcıların gördüğü tazelik süresi
    // Server-side L2 cache (Supabase) YouTube API'yi koruyor,
    // bu sadece Vercel Edge'den servis süresi
    const cacheSeconds = (hour >= 2 && hour < 10) ? 1800     // Gece: 30 dk
      : (hour >= 10 && hour < 17) ? 180                       // Gündüz: 3 dk
      : 60;                                                     // Prime time: 1 dk

    return NextResponse.json({ videos }, {
      headers: {
        'Cache-Control': `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`,
      },
    });
  } catch (error) {
    console.error('API route error:', error);
    // SON ÇARE: Hata durumunda da DB'den serve et
    try {
      const dbVideos = await getVideosFromDB(channelIds, maxResults * channelIds.length);
      if (dbVideos.length > 0) {
        return NextResponse.json({ videos: dbVideos }, {
          headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
        });
      }
    } catch {}

    return NextResponse.json(
      { error: 'Failed to fetch videos', videos: [] },
      {
        status: 200, // 200 dön ki client JSON parse edebilsin
        headers: {
          'Cache-Control': 'no-store', // Hatalı sonucu cache'leme
        },
      }
    );
  }
}
