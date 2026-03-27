import { NextResponse } from 'next/server';

// =============================================
// PİYASA VERİLERİ API
// Döviz, altın, BIST — ücretsiz kaynaklardan
// Edge CDN cache: 2 dakika
// =============================================

interface MarketItem {
  symbol: string;
  label: string;
  value: string;
  change: string;
  changePercent: string;
  direction: 'up' | 'down' | 'neutral';
}

// Truncgil API — Türk piyasa verileri (ücretsiz)
async function fetchFromTruncgil(): Promise<MarketItem[]> {
  try {
    const res = await fetch('https://api.truncgil.com/v1/economy/all', {
      headers: { 'User-Agent': 'ZapTube/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error('truncgil failed');
    const data = await res.json();

    const items: MarketItem[] = [];

    // USD/TRY
    if (data?.USD) {
      const usd = data.USD;
      items.push({
        symbol: 'USD/TRY',
        label: 'Dolar',
        value: Number(usd.Buying || usd.buying || 0).toFixed(4),
        change: String(usd.Change || usd.change || '0'),
        changePercent: String(usd.ChangePercent || usd.changePercent || '0'),
        direction: Number(usd.Change || usd.change || 0) >= 0 ? 'up' : 'down',
      });
    }

    // EUR/TRY
    if (data?.EUR) {
      const eur = data.EUR;
      items.push({
        symbol: 'EUR/TRY',
        label: 'Euro',
        value: Number(eur.Buying || eur.buying || 0).toFixed(4),
        change: String(eur.Change || eur.change || '0'),
        changePercent: String(eur.ChangePercent || eur.changePercent || '0'),
        direction: Number(eur.Change || eur.change || 0) >= 0 ? 'up' : 'down',
      });
    }

    // GBP/TRY
    if (data?.GBP) {
      const gbp = data.GBP;
      items.push({
        symbol: 'GBP/TRY',
        label: 'Sterlin',
        value: Number(gbp.Buying || gbp.buying || 0).toFixed(4),
        change: String(gbp.Change || gbp.change || '0'),
        changePercent: String(gbp.ChangePercent || gbp.changePercent || '0'),
        direction: Number(gbp.Change || gbp.change || 0) >= 0 ? 'up' : 'down',
      });
    }

    // Altın
    if (data?.GRA) {
      const gold = data.GRA;
      items.push({
        symbol: 'XAU/TRY',
        label: 'Altın (gr)',
        value: Number(gold.Buying || gold.buying || 0).toFixed(2),
        change: String(gold.Change || gold.change || '0'),
        changePercent: String(gold.ChangePercent || gold.changePercent || '0'),
        direction: Number(gold.Change || gold.change || 0) >= 0 ? 'up' : 'down',
      });
    }

    return items;
  } catch (err) {
    console.error('Truncgil fetch failed:', err);
    return [];
  }
}

// Fallback: Exchange Rate API (döviz only, ücretsiz)
async function fetchFromExchangeRate(): Promise<MarketItem[]> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error('er-api failed');
    const data = await res.json();

    const tryRate = data?.rates?.TRY;
    const eurRate = data?.rates?.EUR;
    const gbpRate = data?.rates?.GBP;

    if (!tryRate) return [];

    const items: MarketItem[] = [
      {
        symbol: 'USD/TRY',
        label: 'Dolar',
        value: tryRate.toFixed(4),
        change: '',
        changePercent: '',
        direction: 'neutral',
      },
    ];

    if (eurRate) {
      items.push({
        symbol: 'EUR/TRY',
        label: 'Euro',
        value: (tryRate / eurRate).toFixed(4),
        change: '',
        changePercent: '',
        direction: 'neutral',
      });
    }

    if (gbpRate) {
      items.push({
        symbol: 'GBP/TRY',
        label: 'Sterlin',
        value: (tryRate / gbpRate).toFixed(4),
        change: '',
        changePercent: '',
        direction: 'neutral',
      });
    }

    return items;
  } catch (err) {
    console.error('Exchange rate fallback failed:', err);
    return [];
  }
}

export async function GET() {
  // Önce Truncgil'den dene (Türk piyasa verisi, altın dahil)
  let items = await fetchFromTruncgil();

  // Fallback: Exchange Rate API
  if (items.length === 0) {
    items = await fetchFromExchangeRate();
  }

  const updatedAt = new Date().toISOString();

  return NextResponse.json(
    {
      items,
      updatedAt,
      source: items.length > 0 ? 'live' : 'unavailable',
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300', // 2dk cache
      },
    }
  );
}
