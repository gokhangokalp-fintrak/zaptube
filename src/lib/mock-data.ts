import { Video } from '@/types';

// Mock video data for development without API key
export const mockVideos: Record<string, Video[]> = {
  'erman-toroglu': [
    {
      id: 'mock-erman-1',
      title: 'Galatasaray - Fenerbahçe Derbisi Analizi | Erman Toroğlu Yorumluyor',
      channelTitle: 'Erman Toroğlu',
      channelId: 'UCxQzS8ZbwOz2ePqnkSxBbSA',
      thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      publishedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      viewCount: '245000',
      duration: '18:34',
      url: 'https://www.youtube.com/watch?v=example1',
    },
    {
      id: 'mock-erman-2',
      title: 'Süper Lig\'de Hakem Skandalları! Bunu Kabul Edemeyiz!',
      channelTitle: 'Erman Toroğlu',
      channelId: 'UCxQzS8ZbwOz2ePqnkSxBbSA',
      thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      publishedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
      viewCount: '189000',
      duration: '22:10',
      url: 'https://www.youtube.com/watch?v=example2',
    },
  ],
  'ugur-karakullukcu': [
    {
      id: 'mock-ugur-1',
      title: 'Taktik Analiz: Galatasaray\'ın 4-3-3 Sistemi Nasıl Çalışıyor?',
      channelTitle: 'Uğur Karakullukçu',
      channelId: 'UCGzx8pA0gMKhPSKiVP8sFOA',
      thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      publishedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      viewCount: '98000',
      duration: '25:45',
      url: 'https://www.youtube.com/watch?v=example3',
    },
    {
      id: 'mock-ugur-2',
      title: 'Beşiktaş Savunma Zaafiyeti | Detaylı Taktik İnceleme',
      channelTitle: 'Uğur Karakullukçu',
      channelId: 'UCGzx8pA0gMKhPSKiVP8sFOA',
      thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      publishedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      viewCount: '76000',
      duration: '31:20',
      url: 'https://www.youtube.com/watch?v=example4',
    },
  ],
  'serdar-ali-celikler': [
    {
      id: 'mock-serdar-1',
      title: 'Cimbom Şampiyon Olur mu? Canlı Yayın Sohbeti',
      channelTitle: 'Serdar Ali Çelikler',
      channelId: 'UC1H2J4fMg6CNqNLfKN5DXHQ',
      thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      publishedAt: new Date(Date.now() - 3600000 * 1).toISOString(),
      viewCount: '320000',
      duration: '45:12',
      url: 'https://www.youtube.com/watch?v=example5',
    },
    {
      id: 'mock-serdar-2',
      title: 'Galatasaray Transfer Gündemi | Kim Geliyor Kim Gidiyor?',
      channelTitle: 'Serdar Ali Çelikler',
      channelId: 'UC1H2J4fMg6CNqNLfKN5DXHQ',
      thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      publishedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
      viewCount: '156000',
      duration: '28:50',
      url: 'https://www.youtube.com/watch?v=example6',
    },
  ],
  'ali-ece': [
    {
      id: 'mock-ali-1',
      title: 'Süper Lig 28. Hafta Değerlendirmesi | Tüm Maçlar',
      channelTitle: 'Ali Ece',
      channelId: 'UCbJmx9-ITJYCqmHCHpMKPfg',
      thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      publishedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
      viewCount: '134000',
      duration: '35:22',
      url: 'https://www.youtube.com/watch?v=example7',
    },
  ],
  'sinan-engin': [
    {
      id: 'mock-sinan-1',
      title: 'Beşiktaş Bu Kadroyla Nereye Gider? Sert Açıklama!',
      channelTitle: 'Sinan Engin',
      channelId: 'UCexample-sinan',
      thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      publishedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      viewCount: '210000',
      duration: '15:40',
      url: 'https://www.youtube.com/watch?v=example8',
    },
  ],
  'fenerbahce-youtube': [
    {
      id: 'mock-fb-1',
      title: 'Fenerbahçe 3-1 Antalyaspor | Maç Özeti ve Goller',
      channelTitle: 'FB TV',
      channelId: 'UCexample-fbtv',
      thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      publishedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
      viewCount: '450000',
      duration: '8:30',
      url: 'https://www.youtube.com/watch?v=example9',
    },
  ],
  'trabzonspor-medya': [
    {
      id: 'mock-ts-1',
      title: 'Trabzonspor Hafta Sonu Maç Önü | Kadro Analizi',
      channelTitle: 'TS Medya',
      channelId: 'UCexample-tsmedya',
      thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      publishedAt: new Date(Date.now() - 3600000 * 10).toISOString(),
      viewCount: '67000',
      duration: '12:15',
      url: 'https://www.youtube.com/watch?v=example10',
    },
  ],
};

export function getMockVideosForChannels(channelIds: string[]): Video[] {
  return channelIds
    .flatMap((id) => mockVideos[id] || [])
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}
