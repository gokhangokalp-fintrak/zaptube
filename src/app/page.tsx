'use client';

import { useState, useEffect, useMemo } from 'react';
import channelData from '@/data/channels.json';
import { Channel, Team, ContentType, Video, ChannelData } from '@/types';
import { getMultiChannelVideos, formatViewCount, formatDate } from '@/lib/youtube';
import { getMockVideosForChannels } from '@/lib/mock-data';

const data = channelData as ChannelData;

export default function Home() {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedContentType, setSelectedContentType] = useState<string | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [useMock, setUseMock] = useState(true);

  // Filter channels based on selections
  const filteredChannels = useMemo(() => {
    return data.channels.filter((ch) => {
      const teamMatch = !selectedTeam || selectedTeam === 'genel' || ch.teams.includes(selectedTeam) || ch.teams.includes('genel');
      const contentMatch = !selectedContentType || ch.contentTypes.includes(selectedContentType);
      return teamMatch && contentMatch;
    });
  }, [selectedTeam, selectedContentType]);

  // Load videos when channels change
  useEffect(() => {
    if (filteredChannels.length === 0) {
      setVideos([]);
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

    if (!apiKey || useMock) {
      // Use mock data
      const channelIds = filteredChannels.map((ch) => ch.id);
      setVideos(getMockVideosForChannels(channelIds));
      return;
    }

    // Use real YouTube API
    setLoading(true);
    const channelYtIds = filteredChannels.map((ch) => ch.youtubeChannelId);
    getMultiChannelVideos(channelYtIds, apiKey, 3)
      .then(setVideos)
      .finally(() => setLoading(false));
  }, [filteredChannels, useMock]);

  const handleTeamSelect = (teamId: string) => {
    setSelectedTeam(teamId === selectedTeam ? null : teamId);
  };

  const handleContentTypeSelect = (typeId: string) => {
    setSelectedContentType(typeId === selectedContentType ? null : typeId);
  };

  const handleReset = () => {
    setSelectedTeam(null);
    setSelectedContentType(null);
  };

  return (
    <main className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📺</span>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                <span className="bg-gradient-to-r from-red-500 to-emerald-400 bg-clip-text text-transparent">Zap</span>Tube
              </h1>
              <p className="text-xs text-gray-500 hidden sm:block">YouTube futbol kumandan</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(selectedTeam || selectedContentType) && (
              <button
                onClick={handleReset}
                className="text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-gray-400"
              >
                Sıfırla
              </button>
            )}
            <button
              onClick={() => setUseMock(!useMock)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                useMock ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              {useMock ? '📋 Mock' : '🔴 API'}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 mt-6">
        {/* Hero - Only show when nothing is selected */}
        {!selectedTeam && !selectedContentType && (
          <div className="text-center mb-8 animate-slide-up">
            <h2 className="text-3xl sm:text-4xl font-bold mb-2">
              <span className="bg-gradient-to-r from-red-500 to-emerald-400 bg-clip-text text-transparent">
                Zap Yap!
              </span>{' '}
              ⚡
            </h2>
            <p className="text-gray-400 text-sm sm:text-base max-w-md mx-auto">
              Takımını seç, ne izlemek istediğini belirle — seni doğru kanala zaplarız.
            </p>
          </div>
        )}

        {/* Step 1: Team Selection */}
        <section className="mb-6">
          <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center font-bold">
              1
            </span>
            Takımını Seç
          </h3>
          <div className="flex flex-wrap gap-2 stagger-children">
            {data.teams.map((team) => (
              <button
                key={team.id}
                onClick={() => handleTeamSelect(team.id)}
                className={`kumanda-btn flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  selectedTeam === team.id
                    ? 'ring-2 ring-offset-1 ring-offset-[#0a0a0a] scale-105 shadow-lg'
                    : 'bg-[#1a1a1a] hover:bg-[#222] text-gray-300 hover:text-white'
                }`}
                style={
                  selectedTeam === team.id
                    ? {
                        backgroundColor: team.color + '22',
                        color: team.color === '#000000' ? '#fff' : team.color,
                        borderColor: team.color,
                        boxShadow: `0 0 20px ${team.color}33, inset 0 0 0 1px ${team.color}55`,
                      }
                    : undefined
                }
              >
                <span className="text-lg">{team.emoji}</span>
                <span>{team.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Step 2: Content Type Selection */}
        <section className="mb-8">
          <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center font-bold">
              2
            </span>
            Ne İzlemek İstiyorsun?
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 stagger-children">
            {data.contentTypes.map((ct) => (
              <button
                key={ct.id}
                onClick={() => handleContentTypeSelect(ct.id)}
                className={`kumanda-btn flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-sm transition-all duration-200 ${
                  selectedContentType === ct.id
                    ? 'bg-emerald-500/15 ring-1 ring-emerald-500/50 text-emerald-300 scale-105'
                    : 'bg-[#1a1a1a] hover:bg-[#222] text-gray-400 hover:text-white'
                }`}
              >
                <span className="text-xl">{ct.emoji}</span>
                <span className="font-medium text-xs">{ct.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Active Filters Display */}
        {(selectedTeam || selectedContentType) && (
          <div className="flex items-center gap-2 mb-4 text-sm text-gray-400 animate-slide-up">
            <span>🔍</span>
            {selectedTeam && (
              <span className="px-2 py-0.5 rounded-md bg-white/5">
                {data.teams.find((t) => t.id === selectedTeam)?.emoji}{' '}
                {data.teams.find((t) => t.id === selectedTeam)?.name}
              </span>
            )}
            {selectedContentType && (
              <span className="px-2 py-0.5 rounded-md bg-white/5">
                {data.contentTypes.find((ct) => ct.id === selectedContentType)?.emoji}{' '}
                {data.contentTypes.find((ct) => ct.id === selectedContentType)?.name}
              </span>
            )}
            <span className="text-gray-600">
              — {filteredChannels.length} kanal, {videos.length} video
            </span>
          </div>
        )}

        {/* Matching Channels */}
        {filteredChannels.length > 0 && (selectedTeam || selectedContentType) && (
          <section className="mb-6 animate-slide-up">
            <h3 className="text-sm font-medium text-gray-500 mb-3">📡 Eşleşen Kanallar</h3>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
              {filteredChannels.map((ch) => (
                <a
                  key={ch.id}
                  href={`https://www.youtube.com/channel/${ch.youtubeChannelId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 snap-start bg-[#1a1a1a] hover:bg-[#222] rounded-xl p-3 w-48 transition-all hover:scale-[1.02] group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-lg font-bold">
                      {ch.name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-emerald-400 transition-colors">
                        {ch.name}
                      </p>
                      <div className="flex gap-1 mt-0.5">
                        {ch.teams.map((t) => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">
                            {data.teams.find((team) => team.id === t)?.emoji}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 line-clamp-2">{ch.description}</p>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Videos Grid */}
        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
            <span>🎬</span>
            {selectedTeam || selectedContentType ? 'Önerilen Videolar' : 'Son Videolar'}
          </h3>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-[#1a1a1a] rounded-xl overflow-hidden animate-pulse">
                  <div className="aspect-video bg-gray-800" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-gray-800 rounded w-3/4" />
                    <div className="h-3 bg-gray-800 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : videos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
              {videos.map((video) => (
                <a
                  key={video.id}
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group bg-[#1a1a1a] hover:bg-[#222] rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/20"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-gray-800">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
                    {/* Placeholder thumbnail */}
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
                      <span className="text-4xl opacity-30">▶️</span>
                    </div>
                    {video.duration && (
                      <span className="absolute bottom-2 right-2 z-20 text-[10px] font-medium bg-black/80 px-1.5 py-0.5 rounded">
                        {video.duration}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <h4 className="text-sm font-medium line-clamp-2 group-hover:text-emerald-400 transition-colors leading-snug mb-2">
                      {video.title}
                    </h4>
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span className="truncate">{video.channelTitle}</span>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        {video.viewCount && (
                          <span>{formatViewCount(video.viewCount)} izlenme</span>
                        )}
                        <span>{formatDate(video.publishedAt)}</span>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-gray-600">
              <span className="text-4xl block mb-3">📺</span>
              <p className="text-sm">Bu filtrelere uygun video bulunamadı.</p>
              <p className="text-xs mt-1">Farklı bir takım veya içerik tipi deneyin.</p>
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <footer className="mt-16 border-t border-white/5 py-6 text-center text-xs text-gray-600">
        <p>ZapTube — YouTube futbol kumandan</p>
        <p className="mt-1">Zap yap, doğru kanala ulaş, keyfine bak ⚽⚡</p>
      </footer>
    </main>
  );
}
