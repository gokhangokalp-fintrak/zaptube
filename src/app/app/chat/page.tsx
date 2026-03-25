'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { getChatRooms, getMessages, sendMessage, toggleReaction } from '@/lib/chat';
import type { ChatRoom, ChatMessage, ReactionCount } from '@/types';
import AdBanner from '@/components/ads/AdBanner';

const QUICK_REACTIONS = ['🔥', '😂', '😤', '⚽', '👏'];

interface MessageWithReactions extends ChatMessage {
  reactions?: ReactionCount[];
}

export default function ChatPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email?: string; user_metadata?: any } | null>(null);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<MessageWithReactions[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const subscriptionRef = useRef<any>(null);

  // Lazy init supabase client
  const getSupabase = () => {
    if (!supabaseRef.current) {
      supabaseRef.current = createClient();
    }
    return supabaseRef.current;
  };

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize auth and load rooms
  useEffect(() => {
    const initializeChat = async () => {
      try {
        const supabase = getSupabase();
        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !authUser) {
          setError('Giriş yapmalısınız');
          setLoading(false);
          return;
        }

        setUser(authUser);

        // Load chat rooms
        const roomsList = await getChatRooms();
        setRooms(roomsList);

        // Select first room (general)
        if (roomsList.length > 0) {
          const generalRoom = roomsList.find((r) => r.type === 'general') || roomsList[0];
          setSelectedRoom(generalRoom);
          await loadMessages(generalRoom.id);
        }

        setLoading(false);
      } catch (err) {
        console.error('Initialize error:', err);
        setError(err instanceof Error ? err.message : 'Bir hata oluştu');
        setLoading(false);
      }
    };

    initializeChat();
  }, []);

  // Load messages for selected room
  const loadMessages = async (roomId: string) => {
    try {
      setMessagesLoading(true);
      const messagesList = await getMessages(roomId, 50);
      setMessages(messagesList);
    } catch (err) {
      console.error('Load messages error:', err);
      setError(err instanceof Error ? err.message : 'Mesajlar yüklenemedi');
    } finally {
      setMessagesLoading(false);
    }
  };

  // Subscribe to new messages
  useEffect(() => {
    if (!selectedRoom || !user) return;

    const supabase = getSupabase();

    // Unsubscribe from previous room
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    // Subscribe to new messages in selected room
    subscriptionRef.current = supabase
      .channel(`chat_messages:${selectedRoom.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${selectedRoom.id}`,
        },
        (payload: { new: ChatMessage }) => {
          const newMessage = payload.new;
          setMessages((prev) => [...prev, newMessage]);
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [selectedRoom, user]);

  // Handle room selection
  const handleSelectRoom = async (room: ChatRoom) => {
    setSelectedRoom(room);
    await loadMessages(room.id);
  };

  // Handle send message
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedRoom || !user || sending) return;

    try {
      setSending(true);

      const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous';
      const userAvatar = userName.charAt(0).toUpperCase();

      const newMessage = await sendMessage(
        selectedRoom.id,
        user.id,
        userName,
        userAvatar,
        messageInput.trim()
      );

      if (newMessage) {
        setMessages((prev) => [...prev, newMessage]);
        setMessageInput('');
        scrollToBottom();
      }
    } catch (err) {
      console.error('Send message error:', err);
      setError(err instanceof Error ? err.message : 'Mesaj gönderilemedi');
    } finally {
      setSending(false);
    }
  };

  // Handle reaction toggle
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;

    try {
      await toggleReaction(messageId, user.id, emoji);

      // Update local message state
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId) {
            const reactions = msg.reactions || [];
            const existingReaction = reactions.find((r) => r.emoji === emoji);

            if (existingReaction) {
              if (existingReaction.count > 1) {
                return {
                  ...msg,
                  reactions: reactions
                    .map((r) =>
                      r.emoji === emoji
                        ? { ...r, count: r.count - 1, user_reacted: false }
                        : r
                    )
                    .filter((r) => r.count > 0),
                };
              } else {
                return {
                  ...msg,
                  reactions: reactions.filter((r) => r.emoji !== emoji),
                };
              }
            } else {
              return {
                ...msg,
                reactions: [
                  ...reactions,
                  { emoji, count: 1, user_reacted: true },
                ],
              };
            }
          }
          return msg;
        })
      );
    } catch (err) {
      console.error('Toggle reaction error:', err);
    }
  };

  // Handle quick emoji insert
  const handleQuickEmoji = (emoji: string) => {
    setMessageInput((prev) => prev + emoji);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#111827]">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-gray-600 border-t-red-500"></div>
          <p className="text-gray-400">Sohbet yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#111827]">
        <div className="text-center">
          <p className="mb-4 text-2xl font-bold text-white">💬 Sohbet</p>
          <p className="text-gray-400">Giriş yapmalısınız</p>
        </div>
      </div>
    );
  }

  // Group rooms by type
  const generalRooms = rooms.filter((r) => r.type === 'general');
  const teamRooms = rooms.filter((r) => r.type === 'team');
  const channelRooms = rooms.filter((r) => r.type === 'channel');

  const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous';
  const userAvatar = userName.charAt(0).toUpperCase();

  return (
    <div className="flex h-screen bg-[#111827]">
      {/* Left Sidebar */}
      <div className="flex w-64 flex-col border-r border-gray-700 bg-[#1e293b]">
        {/* Header */}
        <div className="border-b border-gray-700 p-4">
          <h1 className="text-lg font-bold text-white">💬 Sohbet Odaları</h1>
        </div>

        {/* Ad Banner */}
        <div className="border-b border-gray-700 p-2">
          <AdBanner slot="chat-top" className="w-full" />
        </div>

        {/* Rooms List */}
        <div className="flex-1 overflow-y-auto">
          {/* General Section */}
          {generalRooms.length > 0 && (
            <div className="px-2 py-4">
              <h3 className="px-2 py-2 text-xs font-semibold uppercase text-gray-400">
                Genel
              </h3>
              <div className="space-y-1">
                {generalRooms.map((room) => (
                  <button
                    key={room.id}
                    onClick={() => handleSelectRoom(room)}
                    className={`relative w-full rounded-lg px-3 py-2 text-left text-sm transition-all ${
                      selectedRoom?.id === room.id
                        ? 'bg-gray-700 ring-2 ring-red-500 text-white'
                        : 'text-gray-300 hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>
                        {room.emoji} {room.name}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">
                        5
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Team Section */}
          {teamRooms.length > 0 && (
            <div className="px-2 py-4">
              <h3 className="px-2 py-2 text-xs font-semibold uppercase text-gray-400">
                Takım Odaları
              </h3>
              <div className="space-y-1">
                {teamRooms.map((room) => (
                  <button
                    key={room.id}
                    onClick={() => handleSelectRoom(room)}
                    className={`relative w-full rounded-lg px-3 py-2 text-left text-sm transition-all ${
                      selectedRoom?.id === room.id
                        ? 'bg-gray-700 ring-2 ring-red-500 text-white'
                        : 'text-gray-300 hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>
                        <span
                          className="mr-1 inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: room.color || '#666' }}
                        ></span>
                        {room.emoji} {room.name}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">
                        {Math.floor(Math.random() * 20) + 3}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Channel Section */}
          {channelRooms.length > 0 && (
            <div className="px-2 py-4">
              <h3 className="px-2 py-2 text-xs font-semibold uppercase text-gray-400">
                Kanal Odaları
              </h3>
              <div className="space-y-1">
                {channelRooms.map((room) => (
                  <button
                    key={room.id}
                    onClick={() => handleSelectRoom(room)}
                    className={`relative w-full truncate rounded-lg px-3 py-2 text-left text-sm transition-all ${
                      selectedRoom?.id === room.id
                        ? 'bg-gray-700 ring-2 ring-red-500 text-white'
                        : 'text-gray-300 hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">
                        {room.emoji} {room.name}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">
                        {Math.floor(Math.random() * 50) + 2}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Top Bar */}
        {selectedRoom && (
          <div className="border-b border-gray-700 bg-[#1e293b] px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selectedRoom.emoji}</span>
                <div>
                  <h2 className="text-lg font-semibold text-white">{selectedRoom.name}</h2>
                  <p className="text-sm text-gray-400">
                    {selectedRoom.type === 'general' && 'Genel sohbet odası'}
                    {selectedRoom.type === 'team' && 'Takım odası'}
                    {selectedRoom.type === 'channel' && 'Kanal odası'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-green-500/20 px-4 py-2 text-sm text-green-400">
                  🟢 {Math.floor(Math.random() * 200) + 20} çevrimiçi
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-4 rounded-lg bg-red-500/10 p-4 text-sm text-red-400">
              ⚠️ {error}
            </div>
          )}

          {messagesLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-gray-400">Mesajlar yükleniyor...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="mb-2 text-3xl">💬</p>
              <p className="text-gray-400">Henüz mesaj yok</p>
              <p className="mt-1 text-sm text-gray-500">Sohbeti başlatmak için ilk mesajını yaz</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className="group rounded-lg bg-[#0f172a]/50 p-4 transition-colors hover:bg-[#0f172a]"
                >
                  {/* Message Header */}
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-orange-500 font-semibold text-white">
                      {message.user_avatar || message.user_name.charAt(0).toUpperCase()}
                    </div>

                    {/* Message Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{message.user_name}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(message.created_at).toLocaleTimeString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="mt-1 break-words text-gray-200">{message.content}</p>

                      {/* Reactions */}
                      {message.reactions && message.reactions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {message.reactions.map((reaction) => (
                            <button
                              key={reaction.emoji}
                              onClick={() =>
                                handleToggleReaction(message.id, reaction.emoji)
                              }
                              className={`flex items-center gap-1 rounded-full px-2 py-1 text-sm transition-all ${
                                reaction.user_reacted
                                  ? 'bg-gray-600 text-white'
                                  : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                              }`}
                            >
                              <span>{reaction.emoji}</span>
                              <span className="text-xs font-medium">{reaction.count}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Quick Reaction Buttons */}
                      <div className="mt-2 hidden gap-1 opacity-0 transition-opacity group-hover:flex group-hover:opacity-100">
                        {QUICK_REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleToggleReaction(message.id, emoji)}
                            className="flex h-7 w-7 items-center justify-center rounded bg-gray-700/50 text-sm transition-colors hover:bg-gray-600"
                            title={`Tepki: ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        {selectedRoom && (
          <div className="border-t border-gray-700 bg-[#1e293b] p-4">
            {/* Quick Emoji Row */}
            <div className="mb-3 flex gap-2">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleQuickEmoji(emoji)}
                  className="flex h-8 w-8 items-center justify-center rounded bg-gray-700/50 text-sm transition-colors hover:bg-gray-600"
                  title={`Ekle: ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Message Input */}
            <div className="flex gap-3">
              <div className="flex-1">
                <textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Mesajını yaz..."
                  maxLength={500}
                  rows={3}
                  disabled={sending}
                  className="w-full resize-none rounded-lg border border-gray-600 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 transition-colors focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-50"
                />
                {messageInput.length > 400 && (
                  <div className="mt-1 text-right text-xs text-gray-500">
                    {messageInput.length}/500
                  </div>
                )}
              </div>

              {/* Send Button */}
              <button
                onClick={handleSendMessage}
                disabled={!messageInput.trim() || sending}
                className="flex h-full min-h-20 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-red-600 to-orange-500 px-6 font-semibold text-white transition-all hover:from-red-700 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                ) : (
                  '➤ Gönder'
                )}
              </button>
            </div>

            {/* Input Help Text */}
            <p className="mt-2 text-xs text-gray-500">
              Enter ile gönder, Shift+Enter ile satır ekle
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
