'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { getChatRooms, getMessages, sendMessage } from '@/lib/chat';
import type { ChatRoom, ChatMessage } from '@/types';

export default function ChatPanel() {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [user, setUser] = useState<{ id: string; email?: string; user_metadata?: any } | null>(null);
  const [loading, setLoading] = useState(true);
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
        } = await supabase.auth.getUser();

        if (authUser) {
          setUser(authUser);

          // Load chat rooms
          const roomsList = await getChatRooms();
          setRooms(roomsList);

          // Select first room by default
          if (roomsList.length > 0) {
            const defaultRoom = roomsList[0];
            setSelectedRoom(defaultRoom);
            await loadMessages(defaultRoom.id);
          }
        }
      } catch (err) {
        console.error('Initialize error:', err);
      } finally {
        setLoading(false);
      }
    };

    initializeChat();
  }, []);

  // Load messages for selected room
  const loadMessages = async (roomId: string) => {
    try {
      const messagesList = await getMessages(roomId, 30);
      setMessages(messagesList);
    } catch (err) {
      console.error('Load messages error:', err);
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
      .channel(`chat_panel:${selectedRoom.id}`)
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
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  if (loading || !user) {
    return (
      <div className="flex flex-col h-full bg-[#1e293b] rounded-lg border border-white/10 overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-sm">Sohbet yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#1e293b] rounded-lg border border-white/10 overflow-hidden">
      {/* Header with room dropdown */}
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-white text-sm">💬 Canlı Sohbet</h3>
        </div>
        <select
          value={selectedRoom?.id || ''}
          onChange={(e) => {
            const room = rooms.find((r) => r.id === e.target.value);
            if (room) handleSelectRoom(room);
          }}
          className="w-full bg-[#0f172a] text-white text-sm rounded px-2 py-1.5 border border-white/10 focus:outline-none focus:border-white/20"
        >
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.emoji} {room.name}
            </option>
          ))}
        </select>
      </div>

      {/* Messages - scrollable */}
      <div
        className="flex-1 overflow-y-auto p-3 space-y-2"
        style={{ maxHeight: '400px' }}
      >
        {messages.length === 0 ? (
          <p className="text-gray-500 text-xs text-center py-4">Henüz mesaj yok</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="text-sm">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-red-400 text-xs">{msg.user_name}</span>
                <span className="text-gray-600 text-xs">{formatTime(msg.created_at)}</span>
              </div>
              <p className="text-gray-200 text-xs break-words">{msg.content}</p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/10">
        {user ? (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Mesaj yaz..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={sending}
              className="flex-1 bg-[#0f172a] text-white text-sm rounded px-2 py-1.5 border border-white/10 placeholder-gray-500 focus:outline-none focus:border-white/20 disabled:opacity-50"
            />
            <button
              onClick={handleSendMessage}
              disabled={sending || !messageInput.trim()}
              className="px-2 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ➤
            </button>
          </div>
        ) : (
          <p className="text-gray-500 text-xs text-center">Sohbet için giriş yapın</p>
        )}
      </div>
    </div>
  );
}
