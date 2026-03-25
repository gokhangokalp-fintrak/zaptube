import { Video } from '@/types';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export async function searchChannelVideos(
  channelId: string,
  apiKey: string,
  maxResults: number = 6,
  query?: string
): Promise<Video[]> {
  try {
    const params = new URLSearchParams({
      part: 'snippet',
      channelId,
      maxResults: maxResults.toString(),
      order: 'date',
      type: 'video',
      key: apiKey,
    });

    if (query) {
      params.set('q', query);
    }

    const searchRes = await fetch(`${YOUTUBE_API_BASE}/search?${params}`);
    if (!searchRes.ok) throw new Error('YouTube API search failed');
    const searchData = await searchRes.json();

    const videoIds = searchData.items
      ?.map((item: any) => item.id?.videoId)
      .filter(Boolean)
      .join(',');

    if (!videoIds) return [];

    // Get video details for view counts and duration
    const detailsRes = await fetch(
      `${YOUTUBE_API_BASE}/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${apiKey}`
    );
    const detailsData = await detailsRes.json();

    return (detailsData.items || []).map((item: any) => ({
      id: item.id,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      channelId: item.snippet.channelId,
      thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || '',
      publishedAt: item.snippet.publishedAt,
      viewCount: item.statistics?.viewCount,
      duration: parseDuration(item.contentDetails?.duration),
      url: `https://www.youtube.com/watch?v=${item.id}`,
    }));
  } catch (error) {
    console.error('YouTube API error:', error);
    return [];
  }
}

export async function getMultiChannelVideos(
  channelIds: string[],
  apiKey: string,
  maxPerChannel: number = 4
): Promise<Video[]> {
  const allVideos = await Promise.all(
    channelIds.map((id) => searchChannelVideos(id, apiKey, maxPerChannel))
  );

  return allVideos
    .flat()
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

function parseDuration(isoDuration?: string): string {
  if (!isoDuration) return '';
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '';

  const hours = match[1] ? `${match[1]}:` : '';
  const minutes = match[2] ? match[2].padStart(hours ? 2 : 1, '0') : '0';
  const seconds = match[3] ? match[3].padStart(2, '0') : '00';

  return `${hours}${minutes}:${seconds}`;
}

export function formatViewCount(count?: string): string {
  if (!count) return '';
  const num = parseInt(count);
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}B`;
  return count;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Az önce';
  if (diffHours < 24) return `${diffHours} saat önce`;
  if (diffDays < 7) return `${diffDays} gün önce`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} hafta önce`;
  return date.toLocaleDateString('tr-TR');
}
