import { NextRequest, NextResponse } from 'next/server';
import { searchChannelVideos, getMultiChannelVideos } from '@/lib/youtube';

export const dynamic = 'force-dynamic'; // Her zaman sunucuda çalışsın

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
    // Hata durumunda bile boş dönme — client tarafında fallback devreye girsin
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
