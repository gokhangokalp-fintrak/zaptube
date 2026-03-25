import { NextRequest, NextResponse } from 'next/server';
import { searchChannelVideos, getMultiChannelVideos } from '@/lib/youtube';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const channelIds = searchParams.get('channelIds')?.split(',').filter(Boolean) || [];
  const query = searchParams.get('q') || undefined;
  const maxResults = parseInt(searchParams.get('max') || '4');

  const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

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
    if (channelIds.length === 1) {
      const videos = await searchChannelVideos(channelIds[0], apiKey, maxResults, query);
      return NextResponse.json({ videos });
    }

    const videos = await getMultiChannelVideos(channelIds, apiKey, maxResults);
    return NextResponse.json({ videos });
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch videos', videos: [] },
      { status: 500 }
    );
  }
}
