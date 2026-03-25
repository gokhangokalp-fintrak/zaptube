'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import channelData from '@/data/channels.json'
import AdBanner from '@/components/ads/AdBanner'
import { formatViewCount } from '@/lib/youtube'

// Using any for channel data from JSON to avoid type conflicts
interface LocalChannelStats {
  channelId: string
  title: string
  subscriberCount: string
  viewCount: string
  videoCount: string
}

interface ChatRoomStats {
  room: {
    id: string
    slug: string
    name: string
    type: string
    emoji: string
    color: string
  }
  totalMessages: number
  activeUsers: number
  last24hMessages: number
  topUsers: Array<{ name: string; count: number }>
}

interface ChatStatsResponse {
  rooms: ChatRoomStats[]
  totals: {
    totalMessages: number
    totalActiveUsers: number
    totalLast24h: number
    topEmoji: string
  }
}

type SortOption = 'subscribers' | 'views' | 'videos' | 'engagement'

export default function StatsPage() {
  const [channelStats, setChannelStats] = useState<any[]>([])
  const [chatStats, setChatStats] = useState<ChatStatsResponse | null>(null)
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [loadingChat, setLoadingChat] = useState(true)
  const [channelSort, setChannelSort] = useState<SortOption>('subscribers')
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch chat stats
        const chatResponse = await fetch('/api/chat-stats')
        if (chatResponse.ok) {
          const chatData = await chatResponse.json()
          setChatStats(chatData)
        }
      } catch (error) {
        console.error('Error fetching chat stats:', error)
      } finally {
        setLoadingChat(false)
      }

      try {
        // Fetch channel stats - get all commentary channel IDs
        const commentaryIds = (channelData.channels as any[])
          .filter((ch: any) => ch.contentTypes?.some((t: string) => ['yorum', 'analiz', 'sert-yorum', 'taktik'].includes(t)))
          .map((ch: any) => ch.youtubeChannelId)
          .join(',')

        if (commentaryIds) {
          const channelResponse = await fetch(`/api/channel-stats?channelIds=${commentaryIds}`)
          if (channelResponse.ok) {
            const data = await channelResponse.json()
            setChannelStats(data.stats || [])
          }
        }
      } catch (error) {
        console.error('Error fetching channel stats:', error)
      } finally {
        setLoadingChannels(false)
      }
    }

    fetchData()
  }, [])

  // Filter commentary channels (not official team channels with only "ozet" and "canli-yayin")
  const commentaryChannels = useMemo(() => {
    return (channelData.channels as any[]).filter((channel: any) => {
      const hasCommentaryContent = channel.contentTypes?.some((type: string) =>
        ['yorum', 'analiz', 'sert-yorum', 'taktik'].includes(type)
      )
      return hasCommentaryContent
    })
  }, [])

  // Filter channels by selected team
  const filteredChannels = useMemo(() => {
    let filtered = commentaryChannels
    if (selectedTeam) {
      filtered = filtered.filter(ch => ch.team === selectedTeam)
    }
    return filtered
  }, [commentaryChannels, selectedTeam])

  // Sort channels
  const sortedChannels = useMemo(() => {
    const sorted = [...filteredChannels].sort((a, b) => {
      const statsA = channelStats.find((s: any) => s.channelId === a.youtubeChannelId)
      const statsB = channelStats.find((s: any) => s.channelId === b.youtubeChannelId)

      if (!statsA || !statsB) return 0

      switch (channelSort) {
        case 'subscribers':
          return statsB.subscribers - statsA.subscribers
        case 'views':
          return statsB.totalViews - statsA.totalViews
        case 'videos':
          return statsB.totalVideos - statsA.totalVideos
        case 'engagement':
          return statsB.engagement - statsA.engagement
        default:
          return 0
      }
    })
    return sorted
  }, [filteredChannels, channelStats, channelSort])

  // Get unique teams
  const teams = useMemo(() => {
    return Array.from(new Set(commentaryChannels.map(ch => ch.team))).sort()
  }, [commentaryChannels])

  // Find most active chat room
  const mostActiveChatRoom = useMemo(() => {
    if (!chatStats?.rooms) return null
    return chatStats.rooms.reduce((max, room) =>
      room.totalMessages > max.totalMessages ? room : max
    )
  }, [chatStats])

  // Get top users across all rooms
  const topGlobalUsers = useMemo(() => {
    if (!chatStats?.rooms) return []
    const userCounts = new Map<string, number>()
    chatStats.rooms.forEach(room => {
      room.topUsers.forEach(user => {
        userCounts.set(user.name, (userCounts.get(user.name) || 0) + user.count)
      })
    })
    return Array.from(userCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [chatStats])

  const maxMessageCount = useMemo(() => {
    if (!chatStats?.rooms) return 1
    return Math.max(...chatStats.rooms.map(r => r.totalMessages), 1)
  }, [chatStats])

  return (
    <div className="min-h-screen bg-[#111827]">
      {/* Navigation */}
      <nav className="bg-[#1e293b] border-b border-[#334155] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/app" className="text-2xl font-bold text-red-500">
              ⚡ ZapTube
            </Link>
            <div className="flex gap-6 text-sm">
              <Link href="/app" className="text-gray-400 hover:text-white transition">
                📺 Ana Sayfa
              </Link>
              <Link href="/app/chat" className="text-gray-400 hover:text-white transition">
                💬 Sohbet
              </Link>
              <Link href="/app/twitter" className="text-gray-400 hover:text-white transition">
                🐦 Twitter
              </Link>
              <Link href="/app/channels" className="text-gray-400 hover:text-white transition">
                📡 Kanallar
              </Link>
              <span className="text-white font-semibold">
                📊 Reyting
              </span>
            </div>
          </div>
          <div className="text-sm text-gray-400">
            Kullanıcı Paneli
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-12">
        {/* Section A: Commentary Channels Rankings */}
        <section>
          <h2 className="text-3xl font-bold text-white mb-6">🎙️ Yorum &amp; Haber Kanalları Reytingleri</h2>

          {/* Filters */}
          <div className="mb-6 space-y-4">
            {/* Sort buttons */}
            <div className="flex gap-2 flex-wrap">
              {(['subscribers', 'views', 'videos', 'engagement'] as SortOption[]).map(option => (
                <button
                  key={option}
                  onClick={() => setChannelSort(option)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    channelSort === option
                      ? 'bg-red-600 text-white'
                      : 'bg-[#334155] text-gray-300 hover:bg-[#475569]'
                  }`}
                >
                  {option === 'subscribers' && 'Abone'}
                  {option === 'views' && 'İzlenme'}
                  {option === 'videos' && 'Video'}
                  {option === 'engagement' && 'Etkileşim'}
                </button>
              ))}
            </div>

            {/* Team filter buttons */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedTeam(null)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  selectedTeam === null
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#334155] text-gray-300 hover:bg-[#475569]'
                }`}
              >
                Tüm Takımlar
              </button>
              {teams.map(team => (
                <button
                  key={team}
                  onClick={() => setSelectedTeam(team)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    selectedTeam === team
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#334155] text-gray-300 hover:bg-[#475569]'
                  }`}
                >
                  {team}
                </button>
              ))}
            </div>
          </div>

          {/* Channel Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingChannels ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-[#1e293b] rounded-lg p-6 animate-pulse">
                  <div className="h-6 bg-[#334155] rounded w-3/4 mb-4" />
                  <div className="space-y-2">
                    <div className="h-4 bg-[#334155] rounded w-full" />
                    <div className="h-4 bg-[#334155] rounded w-5/6" />
                  </div>
                </div>
              ))
            ) : (
              sortedChannels.map((channel, index) => {
                const stats = channelStats.find((s: any) => s.channelId === channel.youtubeChannelId)
                const rank = index + 1
                const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null

                return (
                  <div
                    key={channel.id}
                    className="bg-[#1e293b] rounded-lg p-6 border border-[#334155] hover:border-red-500 transition"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          {rankEmoji && <span className="text-2xl">{rankEmoji}</span>}
                          <span className="text-sm font-bold text-gray-400">#{rank}</span>
                        </div>
                        <h3 className="text-xl font-bold text-white">{channel.name}</h3>
                        <p className="text-sm text-gray-400">{channel.team}</p>
                      </div>
                    </div>

                    {stats ? (
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm text-gray-400">Abone</span>
                            <span className="text-sm font-semibold text-white">{formatViewCount(String(stats.subscribers))}</span>
                          </div>
                          <div className="w-full bg-[#0f172a] rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-red-500 to-emerald-500 h-2 rounded-full"
                              style={{
                                width: `${Math.min(
                                  (stats.subscribers / Math.max(...channelStats.map(s => s.subscribers))) * 100,
                                  100
                                )}%`
                              }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm text-gray-400">İzlenme</span>
                            <span className="text-sm font-semibold text-white">{formatViewCount(String(stats.totalViews))}</span>
                          </div>
                          <div className="w-full bg-[#0f172a] rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-red-500 to-emerald-500 h-2 rounded-full"
                              style={{
                                width: `${Math.min(
                                  (stats.totalViews / Math.max(...channelStats.map(s => s.totalViews))) * 100,
                                  100
                                )}%`
                              }}
                            />
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-[#334155]">
                          <div>
                            <span className="text-xs text-gray-500">Video</span>
                            <p className="text-lg font-bold text-white">{stats.totalVideos}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-gray-500">Etkileşim</span>
                            <p className="text-lg font-bold text-emerald-400">{stats.engagement.toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-400 text-sm">Veri yükleniyor...</div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* AD PLACEMENT */}
        <AdBanner slot="stats-inline" />

        {/* Section B: Chat Activity Rankings */}
        <section>
          <h2 className="text-3xl font-bold text-white mb-6">💬 Chat Odaları Aktivite Sıralaması</h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {loadingChat ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-[#1e293b] rounded-lg p-6 animate-pulse">
                  <div className="h-6 bg-[#334155] rounded w-3/4 mb-4" />
                  <div className="space-y-2">
                    <div className="h-4 bg-[#334155] rounded w-full" />
                    <div className="h-4 bg-[#334155] rounded w-5/6" />
                  </div>
                </div>
              ))
            ) : chatStats?.rooms ? (
              chatStats.rooms
                .sort((a, b) => b.totalMessages - a.totalMessages)
                .map((room, index) => (
                  <div
                    key={room.room.id}
                    className={`bg-[#1e293b] rounded-lg p-6 border-2 transition ${
                      mostActiveChatRoom?.room.id === room.room.id
                        ? 'border-yellow-500 shadow-lg shadow-yellow-500/20'
                        : 'border-[#334155]'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-3xl">{room.room.emoji}</span>
                      <div>
                        <h3 className="text-xl font-bold text-white">{room.room.name}</h3>
                        <p className="text-xs text-gray-400">{room.room.type}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Toplam Mesaj</span>
                        <span className="text-lg font-bold text-white">{room.totalMessages}</span>
                      </div>
                      <div className="w-full bg-[#0f172a] rounded-full h-3">
                        <div
                          className="bg-gradient-to-r from-red-500 to-emerald-500 h-3 rounded-full"
                          style={{
                            width: `${(room.totalMessages / maxMessageCount) * 100}%`
                          }}
                        />
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-[#334155]">
                        <div>
                          <span className="text-xs text-gray-500">Aktif Kullanıcı</span>
                          <p className="text-lg font-bold text-white">{room.activeUsers}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-gray-500">Bugün</span>
                          <p className="text-lg font-bold text-emerald-400">{room.last24hMessages}</p>
                        </div>
                      </div>

                      {room.topUsers.length > 0 && (
                        <div className="pt-2 border-t border-[#334155]">
                          <span className="text-xs text-gray-500 block mb-2">En Aktif Kullanıcılar</span>
                          <div className="space-y-1">
                            {room.topUsers.slice(0, 3).map((user, idx) => (
                              <div key={idx} className="flex justify-between text-xs">
                                <span className="text-gray-300">{user.name}</span>
                                <span className="text-gray-400">{user.count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
            ) : (
              <div className="text-gray-400">Chat verisi yüklenemedi</div>
            )}
          </div>

          {/* Top Global Users */}
          {topGlobalUsers.length > 0 && (
            <div className="bg-[#1e293b] rounded-lg p-6 border border-[#334155]">
              <h3 className="text-2xl font-bold text-white mb-6">🏆 En Aktif Kullanıcılar</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topGlobalUsers.map((user, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-[#0f172a] rounded-lg p-4 border border-[#334155]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-red-500">#{index + 1}</span>
                      <span className="text-white font-semibold">{user.name}</span>
                    </div>
                    <span className="text-emerald-400 font-bold">{user.count} mesaj</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Section C: General Statistics */}
        <section>
          <h2 className="text-3xl font-bold text-white mb-6">📊 Platform Genel Bakış</h2>

          {loadingChat ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-[#1e293b] rounded-lg p-6 animate-pulse">
                  <div className="h-4 bg-[#334155] rounded w-2/3 mb-4" />
                  <div className="h-8 bg-[#334155] rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : chatStats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-[#1e293b] rounded-lg p-6 border border-[#334155]">
                <p className="text-gray-400 text-sm mb-2">Toplam Mesaj</p>
                <p className="text-4xl font-bold text-white">{chatStats.totals.totalMessages}</p>
              </div>

              <div className="bg-[#1e293b] rounded-lg p-6 border border-[#334155]">
                <p className="text-gray-400 text-sm mb-2">Aktif Kullanıcı</p>
                <p className="text-4xl font-bold text-white">{chatStats.totals.totalActiveUsers}</p>
              </div>

              <div className="bg-[#1e293b] rounded-lg p-6 border border-[#334155]">
                <p className="text-gray-400 text-sm mb-2">Bugünkü Mesaj</p>
                <p className="text-4xl font-bold text-emerald-400">{chatStats.totals.totalLast24h}</p>
              </div>

              <div className="bg-[#1e293b] rounded-lg p-6 border border-[#334155]">
                <p className="text-gray-400 text-sm mb-2">En Popüler Emoji</p>
                <p className="text-4xl font-bold text-white">{chatStats.totals.topEmoji}</p>
              </div>

              <div className="bg-[#1e293b] rounded-lg p-6 border border-[#334155]">
                <p className="text-gray-400 text-sm mb-2">Toplam Kanal</p>
                <p className="text-4xl font-bold text-white">{commentaryChannels.length}</p>
              </div>

              <div className="bg-[#1e293b] rounded-lg p-6 border border-[#334155]">
                <p className="text-gray-400 text-sm mb-2">Toplam Oda</p>
                <p className="text-4xl font-bold text-white">{chatStats.rooms.length}</p>
              </div>
            </div>
          ) : (
            <div className="text-gray-400">İstatistik verisi yüklenemedi</div>
          )}
        </section>
      </div>
    </div>
  )
}
