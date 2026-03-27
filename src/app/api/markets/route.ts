import { NextResponse } from 'next/server';

// =============================================
// PİYASA VERİLERİ API
// Döviz, altın, BIST, kripto, emtia — ücretsiz kaynaklardan
// Kategori bazlı gruplu veri
// Edge CDN cache: 2 dakika
// =============================================

interface MarketItem {
  symbol: string;
  label: string;
  value: string;
  change: string;
  changePercent: string;
  direction: 'up' | 'down' | 'neutral';
  category: string;
}

function parseItem(
  data: any,
  key: string,
  symbol: string,
  label: string,
  category: string,
  decimals = 4
): MarketItem | null {
  const item = data?.[key];
  if (!item) return null;

  const buying = Number(item.Buying || item.buying || item.Selling || item.selling || 0);
  if (buying === 0) return null;

  const change = Number(item.Change || item.change || 0);
  const changePercent = item.ChangePercent || item.changePercent || item.Rate || item.rate || '';

  return {
    symbol,
    label,
    value: buying.toFixed(decimals),
    change: String(change),
    changePercent: String(changePercent),
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
    category,
  };
}

// Truncgil API — Türk piyasa verileri (ücretsiz)
async function fetchFromTruncgil(): Promise<MarketItem[]> {
  try {
    const res = await fetch('https://api.truncgil.com/v1/economy/all', {
      headers: { 'User-Agent': 'ZapTube/1.0' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error('truncgil failed');
    const data = await res.json();

    const items: (MarketItem | null)[] = [
      // — DÖVİZ —
      parseItem(data, 'USD', 'USD/TRY', 'Dolar', 'doviz'),
      parseItem(data, 'EUR', 'EUR/TRY', 'Euro', 'doviz'),
      parseItem(data, 'GBP', 'GBP/TRY', 'Sterlin', 'doviz'),
      parseItem(data, 'CHF', 'CHF/TRY', 'İsviçre Frangı', 'doviz'),
      parseItem(data, 'JPY', 'JPY/TRY', 'Japon Yeni', 'doviz'),
      parseItem(data, 'SAR', 'SAR/TRY', 'Suudi Riyali', 'doviz'),

      // — ALTIN & DEĞERLİ MADENLER —
      parseItem(data, 'GRA', 'XAU/gr', 'Gram Altın', 'altin', 2),
      parseItem(data, 'CEY', 'CEY', 'Çeyrek Altın', 'altin', 2),
      parseItem(data, 'YAR', 'YAR', 'Yarım Altın', 'altin', 2),
      parseItem(data, 'TAM', 'TAM', 'Tam Altın', 'altin', 2),
      parseItem(data, 'CUM', 'CUM', 'Cumhuriyet Altını', 'altin', 2),
      parseItem(data, 'ATA', 'ATA', 'Ata Altın', 'altin', 2),
      parseItem(data, 'ONS', 'XAU/oz', 'Ons Altın ($)', 'altin', 2),
      parseItem(data, 'GUM', 'XAG/gr', 'Gümüş (gr)', 'altin', 2),

      // — KRİPTO —
      parseItem(data, 'BTC', 'BTC/TRY', 'Bitcoin', 'kripto', 0),
      parseItem(data, 'ETH', 'ETH/TRY', 'Ethereum', 'kripto', 0),

      // — BORSA —
      parseItem(data, 'XU100', 'BIST100', 'BIST 100', 'borsa', 2),

      // — EMTİA —
      parseItem(data, 'PETROL', 'BRENT', 'Brent Petrol ($)', 'emtia', 2),
    ];

    return items.filter((i): i is MarketItem => i !== null);
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
      { symbol: 'USD/TRY', label: 'Dolar', value: tryRate.toFixed(4), change: '', changePercent: '', direction: 'neutral', category: 'doviz' },
    ];

    if (eurRate) items.push({ symbol: 'EUR/TRY', label: 'Euro', value: (tryRate / eurRate).toFixed(4), change: '', changePercent: '', direction: 'neutral', category: 'doviz' });
    if (gbpRate) items.push({ symbol: 'GBP/TRY', label: 'Sterlin', value: (tryRate / gbpRate).toFixed(4), change: '', changePercent: '', direction: 'neutral', category: 'doviz' });

    return items;
  } catch (err) {
    console.error('Exchange rate fallback failed:', err);
    return [];
  }
}

export async function GET() {
  let items = await fetchFromTruncgil();

  if (items.length === 0) {
    items = await fetchFromExchangeRate();
  }

  // Kategorilere göre grupla
  const categories = [
    { id: 'doviz', name: 'Döviz', emoji: '💱' },
    { id: 'altin', name: 'Altın & Değerli Madenler', emoji: '🥇' },
    { id: 'borsa', name: 'Borsa', emoji: '📈' },
    { id: 'kripto', name: 'Kripto', emoji: '₿' },
    { id: 'emtia', name: 'Emtia', emoji: '🛢️' },
  ];

  const grouped = categories
    .map((cat) => ({
      ...cat,
      items: items.filter((i) => i.category === cat.id),
    }))
    .filter((g) => g.items.length > 0);

  const updatedAt = new Date().toISOString();

  return NextResponse.json(
    {
      groups: grouped,
      total: items.length,
      updatedAt,
      source: items.length > 0 ? 'live' : 'unavailable',
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    }
  );
}
