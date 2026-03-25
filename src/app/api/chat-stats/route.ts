import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ rooms: [], totals: { totalMessages: 0, totalActiveUsers: 0, totalLast24h: 0, topEmoji: '🔥' } })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Fetch all rooms
    const { data: rooms, error: roomsError } = await supabase
      .from('chat_rooms')
      .select('id, slug, name, type, emoji, color')

    if (roomsError) throw roomsError
    if (!rooms || rooms.length === 0) {
      return NextResponse.json({
        rooms: [],
        totals: {
          totalMessages: 0,
          totalActiveUsers: 0,
          totalLast24h: 0,
          topEmoji: '💬'
        }
      })
    }

    const now = new Date()
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // For each room, fetch statistics
    const roomStats = await Promise.all(
      rooms.map(async (room) => {
        // Count total messages in room
        const { count: totalMessages } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', room.id)

        // Count distinct users in room
        const { data: userCountData } = await supabase
          .from('chat_messages')
          .select('user_id')
          .eq('room_id', room.id)

        const activeUsers = userCountData ? new Set(userCountData.map((m: { user_id: string }) => m.user_id)).size : 0

        // Count messages in last 24 hours
        const { count: last24hMessages } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', room.id)
          .gte('created_at', last24h.toISOString())

        // Get top 5 users by message count
        const { data: topUsersData } = await supabase
          .from('chat_messages')
          .select('user_name')
          .eq('room_id', room.id)

        const userCounts = new Map<string, number>()
        if (topUsersData) {
          topUsersData.forEach(msg => {
            if (msg.user_name) {
              userCounts.set(msg.user_name, (userCounts.get(msg.user_name) || 0) + 1)
            }
          })
        }

        const topUsers = Array.from(userCounts.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)

        return {
          room,
          totalMessages: totalMessages || 0,
          activeUsers,
          last24hMessages: last24hMessages || 0,
          topUsers
        }
      })
    )

    // Calculate totals
    let totalMessages = 0
    let totalActiveUsers = new Set<string>()
    let totalLast24h = 0

    const { data: allMessages } = await supabase
      .from('chat_messages')
      .select('user_id')

    if (allMessages) {
      allMessages.forEach(msg => {
        if (msg.user_id) {
          totalActiveUsers.add(msg.user_id)
        }
      })
    }

    roomStats.forEach(stat => {
      totalMessages += stat.totalMessages
      totalLast24h += stat.last24hMessages
    })

    // Get most used emoji
    const { data: reactionsData } = await supabase
      .from('chat_reactions')
      .select('emoji')

    const emojiCounts = new Map<string, number>()
    if (reactionsData) {
      reactionsData.forEach(reaction => {
        if (reaction.emoji) {
          emojiCounts.set(reaction.emoji, (emojiCounts.get(reaction.emoji) || 0) + 1)
        }
      })
    }

    const topEmoji = Array.from(emojiCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || '💬'

    return NextResponse.json({
      rooms: roomStats,
      totals: {
        totalMessages,
        totalActiveUsers: totalActiveUsers.size,
        totalLast24h,
        topEmoji
      }
    })
  } catch (error) {
    console.error('Chat stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chat statistics' },
      { status: 500 }
    )
  }
}
