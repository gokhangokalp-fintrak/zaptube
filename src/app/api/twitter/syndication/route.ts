import { NextRequest, NextResponse } from 'next/server';

// Cache tweet HTML in memory (5 min TTL)
const cache = new Map<string, { html: string; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const handle = request.nextUrl.searchParams.get('handle');
  if (!handle) {
    return NextResponse.json({ error: 'handle required' }, { status: 400 });
  }

  // Check cache
  const cacheKey = `syn:${handle}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ html: cached.html, cached: true });
  }

  // Try syndication endpoint (works without auth on server-side)
  try {
    const synUrl = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${encodeURIComponent(handle)}`;
    const res = await fetch(synUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const html = await res.text();
      if (html && html.length > 100) {
        cache.set(cacheKey, { html, ts: Date.now() });
        return NextResponse.json({ html, cached: false });
      }
    }
  } catch (e) {
    console.log('[Twitter Syndication] Failed for', handle, e instanceof Error ? e.message : '');
  }

  // Try oEmbed API as fallback
  try {
    const oembedUrl = `https://publish.twitter.com/oembed?url=https://twitter.com/${encodeURIComponent(handle)}&partner=&hide_thread=false&widget_type=timeline&theme=dark&chrome=noheader%20nofooter`;
    const res = await fetch(oembedUrl, {
      headers: { 'User-Agent': 'ZapTube/1.0' },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.html) {
        cache.set(cacheKey, { html: data.html, ts: Date.now() });
        return NextResponse.json({ html: data.html, cached: false, source: 'oembed' });
      }
    }
  } catch (e) {
    console.log('[Twitter oEmbed] Failed for', handle, e instanceof Error ? e.message : '');
  }

  return NextResponse.json({ html: null, error: 'Could not fetch timeline' }, { status: 200 });
}
