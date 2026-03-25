import { NextRequest, NextResponse } from 'next/server';
import {
  getLiveScores,
  getStandings,
  getFixtures,
  getTopScorers,
  getAllSportsData,
} from '@/lib/sports-api';

// GET /api/sports?type=live|standings|fixtures|scorers|all
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type') || 'all';

  try {
    let data: any;

    switch (type) {
      case 'live':
        data = await getLiveScores();
        break;
      case 'standings':
        data = await getStandings();
        break;
      case 'fixtures':
        data = await getFixtures();
        break;
      case 'scorers':
        data = await getTopScorers();
        break;
      case 'all':
      default:
        data = await getAllSportsData();
        break;
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Sports API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sports data' },
      { status: 500 }
    );
  }
}
