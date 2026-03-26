import { NextRequest, NextResponse } from 'next/server';

// Tweet bilgisi
interface TweetInfo {
  id: string;
  handle: string;
  timestamp?: number;
}

// Memory cache — 10 dakika TTL
const cache = new Map<string, { tweets: TweetInfo[]; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 min

// Syndication'dan tweet ID'lerini çıkar
async function fetchTweetIds(handle: string): Promise<TweetInfo[]> {
  try {
    const url = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${encodeURIComponent(handle)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return [];

    const html = await res.text();
    if (!html || html.length < 100) return [];

    // HTML'den tweet ID'lerini regex ile çıkar
    // Pattern: data-tweet-id="XXXXX" veya /status/XXXXX gibi
    const tweetIds: TweetInfo[] = [];
    const seen = new Set<string>();

    // Pattern 1: data-tweet-id="1234567890"
    const idPattern1 = /data-tweet-id="(\d{10,}?)"/g;
    let match;
    while ((match = idPattern1.exec(html)) !== null) {
      if (!seen.has(match[1])) {
        seen.add(match[1]);
        tweetIds.push({ id: match[1], handle });
      }
    }

    // Pattern 2: /status/1234567890 (URL'lerden)
    const idPattern2 = /\/status\/(\d{10,})/g;
    while ((match = idPattern2.exec(html)) !== null) {
      if (!seen.has(match[1])) {
        seen.add(match[1]);
        tweetIds.push({ id: match[1], handle });
      }
    }

    // Pattern 3: "id_str":"1234567890" (JSON embedded)
    const idPattern3 = /"id_str"\s*:\s*"(\d{10,}?)"/g;
    while ((match = idPattern3.exec(html)) !== null) {
      if (!seen.has(match[1])) {
        seen.add(match[1]);
        tweetIds.push({ id: match[1], handle });
      }
    }

    return tweetIds;
  } catch (e) {
    console.log(`[Twitter Tweets] Failed for @${handle}:`, e instanceof Error ? e.message : '');
    return [];
  }
}

export async function GET(request: NextRequest) {
  const handlesParam = request.nextUrl.searchParams.get('handles');
  const maxPerHandle = parseInt(request.nextUrl.searchParams.get('max') || '5');

  if (!handlesParam) {
    return NextResponse.json({ error: 'handles parameter required (comma separated)' }, { status: 400 });
  }

  const handles = handlesParam.split(',').map(h => h.trim()).filter(Boolean);
  if (handles.length === 0) {
    return NextResponse.json({ error: 'No valid handles' }, { status: 400 });
  }

  // Her handle için cache kontrol et veya fetch et
  const allTweets: TweetInfo[] = [];
  const fetchPromises: Promise<void>[] = [];

  for (const handle of handles) {
    const cacheKey = `tweets:${handle}`;
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      allTweets.push(...cached.tweets.slice(0, maxPerHandle));
    } else {
      fetchPromises.push(
        fetchTweetIds(handle).then(tweets => {
          cache.set(cacheKey, { tweets, ts: Date.now() });
          allTweets.push(...tweets.slice(0, maxPerHandle));
        })
      );
    }
  }

  // Parallel fetch
  await Promise.allSettled(fetchPromises);

  // Tweet ID'leri büyükten küçüğe sırala (yeniden eskiye)
  // Twitter ID'leri snowflake — büyük ID = daha yeni
  allTweets.sort((a, b) => {
    const aNum = BigInt(a.id);
    const bNum = BigInt(b.id);
    if (bNum > aNum) return 1;
    if (bNum < aNum) return -1;
    return 0;
  });

  return NextResponse.json({
    tweets: allTweets,
    count: allTweets.length,
    handles: handles.length,
  });
}
