import { NextRequest, NextResponse } from 'next/server';
import { getChannelStats } from '@/lib/youtube';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const channelIds = searchParams.get('channelIds')?.split(',').filter(Boolean) || [];

  const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'YouTube API key is not configured', stats: [] },
      { status: 500 }
    );
  }

  if (channelIds.length === 0) {
    return NextResponse.json({ stats: [] });
  }

  try {
    const stats = await getChannelStats(channelIds, apiKey);
    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Channel stats API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch channel stats', stats: [] },
      { status: 500 }
    );
  }
}
