import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

// =============================================
// HABER AKIŞI API — Türk haber sitelerinden RSS
// Kategoriler: gündem, ekonomi, dünya, spor, teknoloji
// Edge CDN cache ile optimize
// =============================================

const parser = new Parser({
  timeout: 8000,
  headers: {
    'User-Agent': 'ZapTube/1.0 (RSS Reader)',
    Accept: 'application/rss+xml, application/xml, text/xml',
  },
});

// Türk haber kaynakları — RSS feed URL'leri
const RSS_SOURCES: Record<string, { name: string; feeds: { url: string; source: string }[] }> = {
  gundem: {
    name: 'Gündem',
    feeds: [
      { url: 'https://www.hurriyet.com.tr/rss/gundem', source: 'Hürriyet' },
      { url: 'https://www.ntv.com.tr/gundem.rss', source: 'NTV' },
      { url: 'https://www.cumhuriyet.com.tr/rss/son_dakika.xml', source: 'Cumhuriyet' },
      { url: 'https://t24.com.tr/rss', source: 'T24' },
    ],
  },
  ekonomi: {
    name: 'Ekonomi',
    feeds: [
      { url: 'https://www.hurriyet.com.tr/rss/ekonomi', source: 'Hürriyet' },
      { url: 'https://www.ntv.com.tr/ekonomi.rss', source: 'NTV' },
      { url: 'https://www.bloomberght.com/rss', source: 'Bloomberg HT' },
    ],
  },
  dunya: {
    name: 'Dünya',
    feeds: [
      { url: 'https://www.hurriyet.com.tr/rss/dunya', source: 'Hürriyet' },
      { url: 'https://www.ntv.com.tr/dunya.rss', source: 'NTV' },
      { url: 'https://www.cumhuriyet.com.tr/rss/dunya.xml', source: 'Cumhuriyet' },
    ],
  },
  spor: {
    name: 'Spor',
    feeds: [
      { url: 'https://www.hurriyet.com.tr/rss/spor', source: 'Hürriyet' },
      { url: 'https://www.ntv.com.tr/spor.rss', source: 'NTV' },
    ],
  },
  teknoloji: {
    name: 'Teknoloji',
    feeds: [
      { url: 'https://www.hurriyet.com.tr/rss/teknoloji', source: 'Hürriyet' },
      { url: 'https://www.ntv.com.tr/teknoloji.rss', source: 'NTV' },
    ],
  },
};

interface NewsItem {
  id: string;
  title: string;
  link: string;
  source: string;
  category: string;
  categoryName: string;
  pubDate: string;
  description: string;
  image?: string;
}

async function fetchFeed(
  feedUrl: string,
  sourceName: string,
  category: string,
  categoryName: string
): Promise<NewsItem[]> {
  try {
    const feed = await parser.parseURL(feedUrl);
    return (feed.items || []).slice(0, 10).map((item) => {
      // Görsel çıkarma — enclosure, media, veya content'ten
      let image: string | undefined;
      if ((item as any).enclosure?.url) {
        image = (item as any).enclosure.url;
      } else if ((item as any)['media:content']?.$.url) {
        image = (item as any)['media:content'].$.url;
      } else if ((item as any)['media:thumbnail']?.$.url) {
        image = (item as any)['media:thumbnail'].$.url;
      } else {
        // content veya description'dan img src çek
        const content = item['content:encoded'] || item.content || item.contentSnippet || '';
        const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (imgMatch) image = imgMatch[1];
      }

      // Description temizle (HTML tag'larını kaldır)
      const rawDesc = item.contentSnippet || item.content || item.summary || '';
      const description = rawDesc
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200);

      return {
        id: `${sourceName}-${item.guid || item.link || item.title}`.replace(/[^a-zA-Z0-9-]/g, '_'),
        title: item.title || 'Başlıksız',
        link: item.link || '#',
        source: sourceName,
        category,
        categoryName,
        pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
        description,
        image,
      };
    });
  } catch (err) {
    console.error(`RSS fetch failed: ${feedUrl}`, err);
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || 'gundem';
  const limit = Math.min(Number(searchParams.get('limit')) || 20, 50);

  // Kategori kontrolü
  const sourceConfig = RSS_SOURCES[category];
  if (!sourceConfig) {
    return NextResponse.json(
      { error: 'Geçersiz kategori', categories: Object.keys(RSS_SOURCES) },
      { status: 400 }
    );
  }

  // Tüm feed'leri paralel çek
  const results = await Promise.allSettled(
    sourceConfig.feeds.map((f) => fetchFeed(f.url, f.source, category, sourceConfig.name))
  );

  // Başarılı sonuçları birleştir
  const allNews: NewsItem[] = results
    .filter((r): r is PromiseFulfilledResult<NewsItem[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value);

  // Tarihe göre sırala (en yeni önce)
  allNews.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  // Duplicate title kontrolü
  const seen = new Set<string>();
  const unique = allNews.filter((n) => {
    const key = n.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Edge CDN cache — haberler 5 dk'da bir güncellenir
  const cacheSeconds = 300; // 5 dakika
  return NextResponse.json(
    {
      category,
      categoryName: sourceConfig.name,
      items: unique.slice(0, limit),
      total: unique.length,
      categories: Object.entries(RSS_SOURCES).map(([id, cfg]) => ({
        id,
        name: cfg.name,
      })),
    },
    {
      headers: {
        'Cache-Control': `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`,
      },
    }
  );
}
