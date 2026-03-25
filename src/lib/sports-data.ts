// =============================================
// SÜPER LİG SPORTS DATA SERVICE
// Realistic Turkish Süper Lig 2025-2026 data
// Ready for real API integration (API-Football)
// =============================================

export interface TeamStanding {
  position: number;
  team: string;
  shortName: string;
  emoji: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: ('W' | 'D' | 'L')[];
  logo?: string;
}

export interface Match {
  id: string;
  home: { name: string; shortName: string; emoji: string; score: number | null };
  away: { name: string; shortName: string; emoji: string; score: number | null };
  date: string;
  time: string;
  status: 'upcoming' | 'live' | 'halftime' | 'finished';
  minute?: number;
  week: number;
  stadium: string;
  events: MatchEvent[];
  stats?: MatchStats;
}

export interface MatchEvent {
  minute: number;
  type: 'goal' | 'assist' | 'yellow' | 'red' | 'sub' | 'penalty' | 'own_goal' | 'var';
  player: string;
  team: 'home' | 'away';
  detail?: string;
}

export interface MatchStats {
  possession: [number, number];
  shots: [number, number];
  shotsOnTarget: [number, number];
  corners: [number, number];
  fouls: [number, number];
  offsides: [number, number];
  passes: [number, number];
  passAccuracy: [number, number];
}

export interface TopScorer {
  rank: number;
  player: string;
  team: string;
  teamEmoji: string;
  goals: number;
  assists: number;
  matches: number;
  minutesPerGoal: number;
  nationality: string;
  flag: string;
}

export interface TeamInfo {
  id: string;
  name: string;
  shortName: string;
  emoji: string;
  color: string;
  stadium: string;
  city: string;
  founded: number;
  manager: string;
}

// =============================================
// TEAM DATABASE
// =============================================
export const SUPER_LIG_TEAMS: TeamInfo[] = [
  { id: 'gs', name: 'Galatasaray', shortName: 'GS', emoji: '🦁', color: '#C8102E', stadium: 'Rams Park', city: 'İstanbul', founded: 1905, manager: 'Okan Buruk' },
  { id: 'fb', name: 'Fenerbahçe', shortName: 'FB', emoji: '🐤', color: '#003DA5', stadium: 'Şükrü Saracoğlu', city: 'İstanbul', founded: 1907, manager: 'José Mourinho' },
  { id: 'bjk', name: 'Beşiktaş', shortName: 'BJK', emoji: '🦅', color: '#000000', stadium: 'Tüpraş Stadyumu', city: 'İstanbul', founded: 1903, manager: 'Giovanni van Bronckhorst' },
  { id: 'ts', name: 'Trabzonspor', shortName: 'TS', emoji: '⭐', color: '#6B0D0D', stadium: 'Papara Park', city: 'Trabzon', founded: 1967, manager: 'Abdullah Avcı' },
  { id: 'bas', name: 'Başakşehir', shortName: 'BŞK', emoji: '🏟️', color: '#F97316', stadium: 'Fatih Terim Stad.', city: 'İstanbul', founded: 1990, manager: 'Çağdaş Atan' },
  { id: 'aly', name: 'Alanyaspor', shortName: 'ALN', emoji: '🍊', color: '#F97316', stadium: 'Bahçeşehir Okul.', city: 'Alanya', founded: 1948, manager: 'Fatih Tekke' },
  { id: 'ant', name: 'Antalyaspor', shortName: 'ANT', emoji: '🌴', color: '#DC2626', stadium: 'Corendon Airlines', city: 'Antalya', founded: 1966, manager: 'Alex de Souza' },
  { id: 'sam', name: 'Samsunspor', shortName: 'SAM', emoji: '🔴', color: '#DC2626', stadium: 'Yeni 19 Mayıs', city: 'Samsun', founded: 1965, manager: 'Thomas Reis' },
  { id: 'kon', name: 'Konyaspor', shortName: 'KON', emoji: '🟢', color: '#22C55E', stadium: 'Konya Büyükşehir', city: 'Konya', founded: 1922, manager: 'Fahrudin Ömerović' },
  { id: 'siv', name: 'Sivasspor', shortName: 'SVS', emoji: '🔵', color: '#2563EB', stadium: 'Yeni 4 Eylül', city: 'Sivas', founded: 1967, manager: 'Bülent Uygun' },
  { id: 'hat', name: 'Hatayspor', shortName: 'HAT', emoji: '🌿', color: '#059669', stadium: 'Yeni Hatay', city: 'Hatay', founded: 1967, manager: 'Volkan Demirel' },
  { id: 'riz', name: 'Rizespor', shortName: 'RİZ', emoji: '🍵', color: '#0EA5E9', stadium: 'Çaykur Didi', city: 'Rize', founded: 1953, manager: 'İlhan Palut' },
  { id: 'goz', name: 'Göztepe', shortName: 'GÖZ', emoji: '🐝', color: '#EAB308', stadium: 'Gürsel Aksel', city: 'İzmir', founded: 1925, manager: 'Stanimir Stoilov' },
  { id: 'kas', name: 'Kasımpaşa', shortName: 'KAS', emoji: '🔷', color: '#1D4ED8', stadium: 'Recep Tayyip Erd.', city: 'İstanbul', founded: 1921, manager: 'Şenol Can' },
  { id: 'kay', name: 'Kayserispor', shortName: 'KAY', emoji: '🟡', color: '#EAB308', stadium: 'Kadir Has', city: 'Kayseri', founded: 1966, manager: 'Sinan Kaloğlu' },
  { id: 'ank', name: 'Ankaragücü', shortName: 'MKE', emoji: '⚓', color: '#1E40AF', stadium: 'Eryaman', city: 'Ankara', founded: 1910, manager: 'Emre Belözoğlu' },
  { id: 'bod', name: 'Bodrumspor', shortName: 'BOD', emoji: '⛵', color: '#06B6D4', stadium: 'Bodrum', city: 'Bodrum', founded: 1939, manager: 'Sergen Yalçın' },
  { id: 'esk', name: 'Eyüpspor', shortName: 'EYÜ', emoji: '🏰', color: '#7C3AED', stadium: 'Eyüp Stad.', city: 'İstanbul', founded: 1969, manager: 'Arda Turan' },
  { id: 'gaz', name: 'Gaziantep FK', shortName: 'GFK', emoji: '🌶️', color: '#DC2626', stadium: 'Kalyon', city: 'Gaziantep', founded: 1988, manager: 'Selçuk İnan' },
];

// =============================================
// STANDINGS (Realistic Week 28 data)
// =============================================
export function getStandings(): TeamStanding[] {
  return [
    { position: 1, team: 'Galatasaray', shortName: 'GS', emoji: '🦁', played: 28, won: 21, drawn: 4, lost: 3, goalsFor: 62, goalsAgainst: 22, goalDifference: 40, points: 67, form: ['W','W','D','W','W'] },
    { position: 2, team: 'Fenerbahçe', shortName: 'FB', emoji: '🐤', played: 28, won: 20, drawn: 5, lost: 3, goalsFor: 58, goalsAgainst: 20, goalDifference: 38, points: 65, form: ['W','D','W','W','L'] },
    { position: 3, team: 'Beşiktaş', shortName: 'BJK', emoji: '🦅', played: 28, won: 16, drawn: 6, lost: 6, goalsFor: 48, goalsAgainst: 28, goalDifference: 20, points: 54, form: ['W','L','W','D','W'] },
    { position: 4, team: 'Trabzonspor', shortName: 'TS', emoji: '⭐', played: 28, won: 14, drawn: 8, lost: 6, goalsFor: 44, goalsAgainst: 30, goalDifference: 14, points: 50, form: ['D','W','W','L','D'] },
    { position: 5, team: 'Başakşehir', shortName: 'BŞK', emoji: '🏟️', played: 28, won: 13, drawn: 7, lost: 8, goalsFor: 38, goalsAgainst: 29, goalDifference: 9, points: 46, form: ['L','W','D','W','W'] },
    { position: 6, team: 'Eyüpspor', shortName: 'EYÜ', emoji: '🏰', played: 28, won: 12, drawn: 8, lost: 8, goalsFor: 35, goalsAgainst: 28, goalDifference: 7, points: 44, form: ['W','D','D','W','L'] },
    { position: 7, team: 'Alanyaspor', shortName: 'ALN', emoji: '🍊', played: 28, won: 11, drawn: 9, lost: 8, goalsFor: 36, goalsAgainst: 30, goalDifference: 6, points: 42, form: ['D','W','L','W','D'] },
    { position: 8, team: 'Samsunspor', shortName: 'SAM', emoji: '🔴', played: 28, won: 11, drawn: 7, lost: 10, goalsFor: 33, goalsAgainst: 32, goalDifference: 1, points: 40, form: ['L','W','W','L','W'] },
    { position: 9, team: 'Göztepe', shortName: 'GÖZ', emoji: '🐝', played: 28, won: 10, drawn: 8, lost: 10, goalsFor: 32, goalsAgainst: 33, goalDifference: -1, points: 38, form: ['W','L','D','D','W'] },
    { position: 10, team: 'Antalyaspor', shortName: 'ANT', emoji: '🌴', played: 28, won: 10, drawn: 7, lost: 11, goalsFor: 30, goalsAgainst: 35, goalDifference: -5, points: 37, form: ['D','L','W','W','L'] },
    { position: 11, team: 'Sivasspor', shortName: 'SVS', emoji: '🔵', played: 28, won: 9, drawn: 8, lost: 11, goalsFor: 28, goalsAgainst: 34, goalDifference: -6, points: 35, form: ['L','D','W','L','D'] },
    { position: 12, team: 'Konyaspor', shortName: 'KON', emoji: '🟢', played: 28, won: 9, drawn: 7, lost: 12, goalsFor: 27, goalsAgainst: 36, goalDifference: -9, points: 34, form: ['W','L','L','D','W'] },
    { position: 13, team: 'Kasımpaşa', shortName: 'KAS', emoji: '🔷', played: 28, won: 8, drawn: 8, lost: 12, goalsFor: 30, goalsAgainst: 38, goalDifference: -8, points: 32, form: ['D','W','L','L','D'] },
    { position: 14, team: 'Bodrumspor', shortName: 'BOD', emoji: '⛵', played: 28, won: 8, drawn: 7, lost: 13, goalsFor: 25, goalsAgainst: 37, goalDifference: -12, points: 31, form: ['L','L','W','D','L'] },
    { position: 15, team: 'Hatayspor', shortName: 'HAT', emoji: '🌿', played: 28, won: 7, drawn: 8, lost: 13, goalsFor: 24, goalsAgainst: 38, goalDifference: -14, points: 29, form: ['D','L','D','L','W'] },
    { position: 16, team: 'Gaziantep FK', shortName: 'GFK', emoji: '🌶️', played: 28, won: 7, drawn: 7, lost: 14, goalsFor: 23, goalsAgainst: 40, goalDifference: -17, points: 28, form: ['L','W','L','L','D'] },
    { position: 17, team: 'Rizespor', shortName: 'RİZ', emoji: '🍵', played: 28, won: 6, drawn: 8, lost: 14, goalsFor: 22, goalsAgainst: 42, goalDifference: -20, points: 26, form: ['L','D','L','W','L'] },
    { position: 18, team: 'Ankaragücü', shortName: 'MKE', emoji: '⚓', played: 28, won: 5, drawn: 9, lost: 14, goalsFor: 21, goalsAgainst: 41, goalDifference: -20, points: 24, form: ['D','L','L','D','L'] },
    { position: 19, team: 'Kayserispor', shortName: 'KAY', emoji: '🟡', played: 28, won: 5, drawn: 6, lost: 17, goalsFor: 18, goalsAgainst: 51, goalDifference: -33, points: 21, form: ['L','L','D','L','L'] },
  ];
}

// =============================================
// TOP SCORERS
// =============================================
export function getTopScorers(): TopScorer[] {
  return [
    { rank: 1, player: 'Mauro Icardi', team: 'Galatasaray', teamEmoji: '🦁', goals: 19, assists: 6, matches: 24, minutesPerGoal: 108, nationality: 'Arjantin', flag: '🇦🇷' },
    { rank: 2, player: 'Edin Džeko', team: 'Fenerbahçe', teamEmoji: '🐤', goals: 16, assists: 5, matches: 26, minutesPerGoal: 138, nationality: 'Bosna', flag: '🇧🇦' },
    { rank: 3, player: 'Ciro Immobile', team: 'Beşiktaş', teamEmoji: '🦅', goals: 14, assists: 4, matches: 25, minutesPerGoal: 152, nationality: 'İtalya', flag: '🇮🇹' },
    { rank: 4, player: 'Vincent Aboubakar', team: 'Trabzonspor', teamEmoji: '⭐', goals: 12, assists: 3, matches: 23, minutesPerGoal: 163, nationality: 'Kamerun', flag: '🇨🇲' },
    { rank: 5, player: 'Kerem Aktürkoğlu', team: 'Galatasaray', teamEmoji: '🦁', goals: 11, assists: 8, matches: 27, minutesPerGoal: 210, nationality: 'Türkiye', flag: '🇹🇷' },
    { rank: 6, player: 'Michy Batshuayi', team: 'Fenerbahçe', teamEmoji: '🐤', goals: 10, assists: 3, matches: 22, minutesPerGoal: 178, nationality: 'Belçika', flag: '🇧🇪' },
    { rank: 7, player: 'Umut Nayir', team: 'Samsunspor', teamEmoji: '🔴', goals: 9, assists: 2, matches: 26, minutesPerGoal: 245, nationality: 'Türkiye', flag: '🇹🇷' },
    { rank: 8, player: 'Stefano Okaka', team: 'Başakşehir', teamEmoji: '🏟️', goals: 9, assists: 4, matches: 24, minutesPerGoal: 220, nationality: 'İtalya', flag: '🇮🇹' },
    { rank: 9, player: 'Semih Kılıçsoy', team: 'Beşiktaş', teamEmoji: '🦅', goals: 8, assists: 5, matches: 25, minutesPerGoal: 260, nationality: 'Türkiye', flag: '🇹🇷' },
    { rank: 10, player: 'Barış Alper Yılmaz', team: 'Galatasaray', teamEmoji: '🦁', goals: 8, assists: 7, matches: 28, minutesPerGoal: 290, nationality: 'Türkiye', flag: '🇹🇷' },
  ];
}

// =============================================
// FIXTURES — Upcoming & Recent
// =============================================
export function getFixtures(): Match[] {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  // Generate relative dates
  const day = (offset: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return fmt(d);
  };

  return [
    // Live matches
    {
      id: 'live-1',
      home: { name: 'Galatasaray', shortName: 'GS', emoji: '🦁', score: 2 },
      away: { name: 'Fenerbahçe', shortName: 'FB', emoji: '🐤', score: 1 },
      date: day(0), time: '20:00', status: 'live', minute: 67, week: 29, stadium: 'Rams Park',
      events: [
        { minute: 23, type: 'goal', player: 'Icardi', team: 'home' },
        { minute: 38, type: 'yellow', player: 'Szymanski', team: 'away' },
        { minute: 45, type: 'goal', player: 'Džeko', team: 'away', detail: 'Penaltı' },
        { minute: 51, type: 'goal', player: 'Kerem', team: 'home', detail: 'Barış Alper asist' },
        { minute: 60, type: 'yellow', player: 'Torreira', team: 'home' },
        { minute: 63, type: 'var', player: '', team: 'home', detail: 'Gol iptal - Ofsayt' },
      ],
      stats: {
        possession: [58, 42], shots: [14, 8], shotsOnTarget: [6, 3],
        corners: [7, 3], fouls: [12, 15], offsides: [2, 1],
        passes: [452, 318], passAccuracy: [87, 82],
      },
    },
    {
      id: 'live-2',
      home: { name: 'Beşiktaş', shortName: 'BJK', emoji: '🦅', score: 0 },
      away: { name: 'Trabzonspor', shortName: 'TS', emoji: '⭐', score: 0 },
      date: day(0), time: '20:00', status: 'live', minute: 34, week: 29, stadium: 'Tüpraş Stadyumu',
      events: [
        { minute: 15, type: 'yellow', player: 'Gedson', team: 'home' },
        { minute: 28, type: 'yellow', player: 'Bakasetas', team: 'away' },
      ],
      stats: {
        possession: [52, 48], shots: [5, 4], shotsOnTarget: [1, 2],
        corners: [3, 2], fouls: [8, 9], offsides: [0, 1],
        passes: [234, 218], passAccuracy: [84, 80],
      },
    },
    // Today finished
    {
      id: 'fin-1',
      home: { name: 'Başakşehir', shortName: 'BŞK', emoji: '🏟️', score: 3 },
      away: { name: 'Antalyaspor', shortName: 'ANT', emoji: '🌴', score: 1 },
      date: day(0), time: '17:00', status: 'finished', minute: 90, week: 29, stadium: 'Fatih Terim Stad.',
      events: [
        { minute: 12, type: 'goal', player: 'Okaka', team: 'home' },
        { minute: 29, type: 'goal', player: 'Visca', team: 'home', detail: 'Frikik' },
        { minute: 44, type: 'goal', player: 'Okaka', team: 'home' },
        { minute: 78, type: 'goal', player: 'Podolski', team: 'away' },
      ],
      stats: {
        possession: [55, 45], shots: [16, 9], shotsOnTarget: [7, 3],
        corners: [8, 4], fouls: [10, 14], offsides: [1, 3],
        passes: [480, 390], passAccuracy: [86, 79],
      },
    },
    // Upcoming
    {
      id: 'up-1',
      home: { name: 'Samsunspor', shortName: 'SAM', emoji: '🔴', score: null },
      away: { name: 'Konyaspor', shortName: 'KON', emoji: '🟢', score: null },
      date: day(1), time: '19:00', status: 'upcoming', week: 29, stadium: 'Yeni 19 Mayıs',
      events: [],
    },
    {
      id: 'up-2',
      home: { name: 'Göztepe', shortName: 'GÖZ', emoji: '🐝', score: null },
      away: { name: 'Kasımpaşa', shortName: 'KAS', emoji: '🔷', score: null },
      date: day(1), time: '21:00', status: 'upcoming', week: 29, stadium: 'Gürsel Aksel',
      events: [],
    },
    {
      id: 'up-3',
      home: { name: 'Eyüpspor', shortName: 'EYÜ', emoji: '🏰', score: null },
      away: { name: 'Sivasspor', shortName: 'SVS', emoji: '🔵', score: null },
      date: day(2), time: '17:00', status: 'upcoming', week: 29, stadium: 'Eyüp Stad.',
      events: [],
    },
    {
      id: 'up-4',
      home: { name: 'Rizespor', shortName: 'RİZ', emoji: '🍵', score: null },
      away: { name: 'Hatayspor', shortName: 'HAT', emoji: '🌿', score: null },
      date: day(2), time: '19:00', status: 'upcoming', week: 29, stadium: 'Çaykur Didi',
      events: [],
    },
    {
      id: 'up-5',
      home: { name: 'Fenerbahçe', shortName: 'FB', emoji: '🐤', score: null },
      away: { name: 'Beşiktaş', shortName: 'BJK', emoji: '🦅', score: null },
      date: day(7), time: '20:00', status: 'upcoming', week: 30, stadium: 'Şükrü Saracoğlu',
      events: [],
    },
    {
      id: 'up-6',
      home: { name: 'Trabzonspor', shortName: 'TS', emoji: '⭐', score: null },
      away: { name: 'Galatasaray', shortName: 'GS', emoji: '🦁', score: null },
      date: day(8), time: '20:00', status: 'upcoming', week: 30, stadium: 'Papara Park',
      events: [],
    },
    // Past results
    {
      id: 'past-1',
      home: { name: 'Fenerbahçe', shortName: 'FB', emoji: '🐤', score: 3 },
      away: { name: 'Trabzonspor', shortName: 'TS', emoji: '⭐', score: 0 },
      date: day(-3), time: '20:00', status: 'finished', minute: 90, week: 28, stadium: 'Şükrü Saracoğlu',
      events: [
        { minute: 15, type: 'goal', player: 'Džeko', team: 'home' },
        { minute: 52, type: 'goal', player: 'Batshuayi', team: 'home' },
        { minute: 78, type: 'red', player: 'Bakasetas', team: 'away' },
        { minute: 85, type: 'goal', player: 'Szymanski', team: 'home' },
      ],
      stats: {
        possession: [62, 38], shots: [18, 5], shotsOnTarget: [8, 2],
        corners: [9, 2], fouls: [11, 16], offsides: [1, 3],
        passes: [520, 310], passAccuracy: [89, 76],
      },
    },
    {
      id: 'past-2',
      home: { name: 'Galatasaray', shortName: 'GS', emoji: '🦁', score: 4 },
      away: { name: 'Kayserispor', shortName: 'KAY', emoji: '🟡', score: 0 },
      date: day(-4), time: '20:00', status: 'finished', minute: 90, week: 28, stadium: 'Rams Park',
      events: [
        { minute: 8, type: 'goal', player: 'Icardi', team: 'home' },
        { minute: 33, type: 'goal', player: 'Kerem', team: 'home' },
        { minute: 55, type: 'goal', player: 'Barış Alper', team: 'home' },
        { minute: 71, type: 'goal', player: 'Icardi', team: 'home', detail: 'Penaltı' },
      ],
      stats: {
        possession: [72, 28], shots: [22, 3], shotsOnTarget: [11, 1],
        corners: [12, 1], fouls: [8, 18], offsides: [2, 0],
        passes: [620, 240], passAccuracy: [92, 68],
      },
    },
  ];
}

// =============================================
// HELPERS
// =============================================
export function formatMatchDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateStr === today.toISOString().split('T')[0]) return 'Bugün';
  if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Yarın';
  if (dateStr === yesterday.toISOString().split('T')[0]) return 'Dün';

  return date.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function getFormColor(result: 'W' | 'D' | 'L'): string {
  switch (result) {
    case 'W': return 'bg-green-500';
    case 'D': return 'bg-yellow-500';
    case 'L': return 'bg-red-500';
  }
}

export function getFormLabel(result: 'W' | 'D' | 'L'): string {
  switch (result) {
    case 'W': return 'G';
    case 'D': return 'B';
    case 'L': return 'M';
  }
}
