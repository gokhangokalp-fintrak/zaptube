// =============================================
// API-FOOTBALL INTEGRATION + SUPABASE CACHE
// Server-side only — API key hidden from client
// Free plan: 100 req/day — cache aggressively!
// =============================================

// Turkish Süper Lig: league ID 203
const LEAGUE_ID = 203;
const SEASON = 2024; // 2024-25 season (API-Football uses start year)

const API_BASE = 'https://v3.football.api-sports.io';

// Cache TTLs (minutes)
const CACHE_TTL = {
  LIVE: 2,           // Live scores: 2 min (maç anında)
  FIXTURES: 120,     // Fikstür: 2 saat
  STANDINGS: 360,    // Puan durumu: 6 saat
  TOP_SCORERS: 720,  // Gol krallığı: 12 saat
  MATCH_DETAIL: 5,   // Maç detay (canlıysa): 5 dk
};

// =============================================
// API CALL HELPER
// =============================================
async function callFootballAPI(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) {
    console.error('FOOTBALL_API_KEY not set');
    return null;
  }

  const url = new URL(`${API_BASE}/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'x-apisports-key': apiKey,
      },
      next: { revalidate: 0 }, // No Next.js cache, we handle our own
    });

    if (!res.ok) {
      console.error(`API-Football error: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();

    // API-Football wraps data in { response: [...] }
    if (data.errors && Object.keys(data.errors).length > 0) {
      console.error('API-Football errors:', data.errors);
      return null;
    }

    return data.response;
  } catch (error) {
    console.error('API-Football fetch error:', error);
    return null;
  }
}

// =============================================
// SUPABASE CACHE HELPERS (server-side)
// =============================================
async function getCachedData(key: string): Promise<any | null> {
  try {
    const { createClient } = await import('@/lib/supabase');
    const supabase = createClient();
    const { data } = await supabase.rpc('get_sports_cache', { p_key: key });
    if (!data) return null;
    // Handle double-stringify: data might be a JSON string inside JSONB
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch {
    return null;
  }
}

async function setCachedData(key: string, data: any, ttlMinutes: number): Promise<void> {
  try {
    const { createClient } = await import('@/lib/supabase');
    const supabase = createClient();
    await supabase.rpc('set_sports_cache', {
      p_key: key,
      p_data: data,
      p_ttl_minutes: ttlMinutes,
    });
  } catch {
    console.warn('Sports cache write failed for:', key);
  }
}

// =============================================
// PUBLIC FUNCTIONS — Used by API routes
// =============================================

/**
 * Canlı Skorlar — maç günü her 2 dk'da bir güncellenir
 * Non-match days: cache'den gelir, 0 API call
 */
export async function getLiveScores() {
  const cacheKey = 'live_scores';
  const cached = await getCachedData(cacheKey);
  if (cached) return cached;

  const data = await callFootballAPI('fixtures', {
    league: LEAGUE_ID.toString(),
    season: SEASON.toString(),
    live: 'all',
  });

  const result = (data || []).map((fixture: any) => ({
    id: fixture.fixture.id,
    home: {
      name: fixture.teams.home.name,
      shortName: shortName(fixture.teams.home.name),
      logo: fixture.teams.home.logo,
      score: fixture.goals.home,
    },
    away: {
      name: fixture.teams.away.name,
      shortName: shortName(fixture.teams.away.name),
      logo: fixture.teams.away.logo,
      score: fixture.goals.away,
    },
    status: mapStatus(fixture.fixture.status.short),
    minute: fixture.fixture.status.elapsed,
    date: fixture.fixture.date,
    stadium: fixture.fixture.venue?.name || '',
    league: 'Süper Lig',
    events: (fixture.events || []).map((e: any) => ({
      minute: e.time.elapsed,
      type: mapEventType(e.type, e.detail),
      player: e.player?.name || '',
      team: e.team.id === fixture.teams.home.id ? 'home' : 'away',
      detail: e.detail,
    })),
  }));

  await setCachedData(cacheKey, result, CACHE_TTL.LIVE);
  return result;
}

/**
 * Puan Durumu — günde 4 kez güncellenir (6 saat cache)
 */
export async function getStandings() {
  const cacheKey = 'standings';
  const cached = await getCachedData(cacheKey);
  if (cached) return cached;

  const data = await callFootballAPI('standings', {
    league: LEAGUE_ID.toString(),
    season: SEASON.toString(),
  });

  if (!data || !data[0]?.league?.standings?.[0]) return [];

  const result = data[0].league.standings[0].map((team: any, idx: number) => ({
    position: team.rank,
    team: team.team.name,
    shortName: shortName(team.team.name),
    logo: team.team.logo,
    played: team.all.played,
    won: team.all.win,
    drawn: team.all.draw,
    lost: team.all.lose,
    goalsFor: team.all.goals.for,
    goalsAgainst: team.all.goals.against,
    goalDifference: team.goalsDiff,
    points: team.points,
    form: (team.form || '').split('').map((c: string) =>
      c === 'W' ? 'W' : c === 'D' ? 'D' : 'L'
    ),
  }));

  await setCachedData(cacheKey, result, CACHE_TTL.STANDINGS);
  return result;
}

/**
 * Fikstür — yaklaşan + son sonuçlar (2 saat cache)
 */
export async function getFixtures() {
  const cacheKey = 'fixtures';
  const cached = await getCachedData(cacheKey);
  if (cached) return cached;

  // Son 10 + Gelecek 10 = 2 API call
  const [lastData, nextData] = await Promise.all([
    callFootballAPI('fixtures', {
      league: LEAGUE_ID.toString(),
      season: SEASON.toString(),
      last: '10',
    }),
    callFootballAPI('fixtures', {
      league: LEAGUE_ID.toString(),
      season: SEASON.toString(),
      next: '10',
    }),
  ]);

  const mapFixture = (f: any) => ({
    id: f.fixture.id.toString(),
    home: {
      name: f.teams.home.name,
      shortName: shortName(f.teams.home.name),
      emoji: getTeamEmoji(f.teams.home.name),
      logo: f.teams.home.logo,
      score: f.goals.home,
    },
    away: {
      name: f.teams.away.name,
      shortName: shortName(f.teams.away.name),
      emoji: getTeamEmoji(f.teams.away.name),
      logo: f.teams.away.logo,
      score: f.goals.away,
    },
    date: f.fixture.date.split('T')[0],
    time: new Date(f.fixture.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    status: mapStatus(f.fixture.status.short),
    minute: f.fixture.status.elapsed,
    week: f.league?.round ? parseInt(f.league.round.replace(/\D/g, '')) || 0 : 0,
    stadium: f.fixture.venue?.name || '',
    events: (f.events || []).map((e: any) => ({
      minute: e.time.elapsed,
      type: mapEventType(e.type, e.detail),
      player: e.player?.name || '',
      team: e.team.id === f.teams.home.id ? 'home' : 'away',
      detail: e.detail,
    })),
    stats: null, // Stats loaded separately for match detail
  });

  const result = [
    ...(lastData || []).map(mapFixture),
    ...(nextData || []).map(mapFixture),
  ];

  await setCachedData(cacheKey, result, CACHE_TTL.FIXTURES);
  return result;
}

/**
 * Gol Krallığı (12 saat cache)
 */
export async function getTopScorers() {
  const cacheKey = 'top_scorers';
  const cached = await getCachedData(cacheKey);
  if (cached) return cached;

  const data = await callFootballAPI('players/topscorers', {
    league: LEAGUE_ID.toString(),
    season: SEASON.toString(),
  });

  if (!data) return [];

  const result = data.slice(0, 15).map((item: any, idx: number) => ({
    rank: idx + 1,
    player: item.player.name,
    team: item.statistics[0]?.team?.name || '',
    teamEmoji: getTeamEmoji(item.statistics[0]?.team?.name || ''),
    teamLogo: item.statistics[0]?.team?.logo || '',
    goals: item.statistics[0]?.goals?.total || 0,
    assists: item.statistics[0]?.goals?.assists || 0,
    matches: item.statistics[0]?.games?.appearences || 0,
    minutesPerGoal: item.statistics[0]?.games?.minutes
      ? Math.round(item.statistics[0].games.minutes / (item.statistics[0].goals.total || 1))
      : 0,
    nationality: item.player.nationality || '',
    photo: item.player.photo || '',
  }));

  await setCachedData(cacheKey, result, CACHE_TTL.TOP_SCORERS);
  return result;
}

/**
 * Tüm veriyi tek seferde getir (dashboard için)
 * Cache'den gelirse 0 API call!
 */
export async function getAllSportsData() {
  const [live, standings, fixtures, topScorers] = await Promise.all([
    getLiveScores(),
    getStandings(),
    getFixtures(),
    getTopScorers(),
  ]);

  return { live, standings, fixtures, topScorers };
}

// =============================================
// HELPERS
// =============================================

function mapStatus(apiStatus: string): 'upcoming' | 'live' | 'halftime' | 'finished' {
  switch (apiStatus) {
    case '1H': case '2H': case 'ET': case 'P': case 'LIVE':
      return 'live';
    case 'HT':
      return 'halftime';
    case 'FT': case 'AET': case 'PEN':
      return 'finished';
    default:
      return 'upcoming'; // NS, TBD, etc.
  }
}

function mapEventType(type: string, detail: string): string {
  if (type === 'Goal') {
    if (detail === 'Penalty') return 'penalty';
    if (detail === 'Own Goal') return 'own_goal';
    return 'goal';
  }
  if (type === 'Card') {
    return detail === 'Yellow Card' ? 'yellow' : 'red';
  }
  if (type === 'subst') return 'sub';
  if (type === 'Var') return 'var';
  return type.toLowerCase();
}

// Turkish team short names
function shortName(name: string): string {
  const map: Record<string, string> = {
    'Galatasaray': 'GS',
    'Fenerbahce': 'FB', 'Fenerbahçe': 'FB',
    'Besiktas': 'BJK', 'Beşiktaş': 'BJK',
    'Trabzonspor': 'TS',
    'Istanbul Basaksehir': 'IBB', 'İstanbul Başakşehir': 'IBB',
    'Adana Demirspor': 'ADS',
    'Antalyaspor': 'ANT',
    'Alanyaspor': 'ALN',
    'Sivasspor': 'SVS',
    'Konyaspor': 'KON',
    'Kayserispor': 'KYS',
    'Gaziantep FK': 'GFK', 'Gazişehir Gaziantep': 'GFK',
    'Hatayspor': 'HTS',
    'Kasimpasa': 'KSM', 'Kasımpaşa': 'KSM',
    'Pendikspor': 'PEN',
    'Samsunspor': 'SMS',
    'Rizespor': 'RZS', 'Çaykur Rizespor': 'RZS',
    'Bodrum FK': 'BOD', 'Bodrumspor': 'BOD',
    'Eyüpspor': 'EYP',
    'Göztepe': 'GOZ',
  };

  // Try exact match first
  if (map[name]) return map[name];

  // Try partial match
  for (const [key, val] of Object.entries(map)) {
    if (name.includes(key) || key.includes(name)) return val;
  }

  // Fallback: first 3 chars
  return name.substring(0, 3).toUpperCase();
}

function getTeamEmoji(name: string): string {
  const map: Record<string, string> = {
    'Galatasaray': '🦁',
    'Fenerbahce': '🐤', 'Fenerbahçe': '🐤',
    'Besiktas': '🦅', 'Beşiktaş': '🦅',
    'Trabzonspor': '⭐',
    'Istanbul Basaksehir': '🏟️', 'İstanbul Başakşehir': '🏟️',
    'Adana Demirspor': '⚡',
    'Antalyaspor': '🌴',
    'Alanyaspor': '🍊',
    'Sivasspor': '🔴',
    'Konyaspor': '🟢',
    'Kayserispor': '🟡',
    'Kasimpasa': '⚓', 'Kasımpaşa': '⚓',
    'Samsunspor': '🔴',
    'Rizespor': '🍵', 'Çaykur Rizespor': '🍵',
    'Göztepe': '🐝',
    'Eyüpspor': '🟣',
    'Bodrum FK': '🏖️', 'Bodrumspor': '🏖️',
  };

  for (const [key, val] of Object.entries(map)) {
    if (name.includes(key) || key.includes(name)) return val;
  }
  return '⚽';
}
