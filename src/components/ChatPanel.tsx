'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { getChatRooms, getMessages, sendMessage, toggleLike, getPinnedMessages } from '@/lib/chat';
import type { ChatRoom, ChatMessage } from '@/types';

// Fake messages for initial activity
const FAKE_MESSAGES = [
  { user: 'Aslan37', avatar: 'A', msg: '🤩 GOOOOLLL! Kerem attı!', likes: 145 },
  { user: 'Kadir07', avatar: 'K', msg: 'Hadi Fener bastırın!', likes: 98 },
  { user: 'Gomez1903', avatar: 'G', msg: '😤 Bu hakem satılmış!', likes: 126 },
  { user: 'SultanFB', avatar: 'S', msg: '💛💙 Bu maç dönmez bence...', likes: 76 },
  { user: 'BurakGS1915', avatar: 'B', msg: '🔴🟡 Şampiyon Cim Bom!', likes: 134 },
  { user: 'KaraKartal', avatar: 'K', msg: '🦅 Beşiktaş geliyooor!', likes: 89 },
  { user: 'Ali_TS61', avatar: 'A', msg: '🔵🔴 Trabzon burada!', likes: 67 },
  { user: 'MaviŞimşek', avatar: 'M', msg: 'Ne maç ama ya! 🔥', likes: 112 },
  { user: 'FenerLi34', avatar: 'F', msg: 'Pozisyon vardı ya! Penaltı!', likes: 95 },
  { user: 'CimBom61', avatar: 'C', msg: 'Harika pas! İcardi bekliyoruz 💪', likes: 83 },
  { user: 'UltraAslan', avatar: 'U', msg: 'Tribünler yıkılıyor! 🏟️', likes: 156 },
  { user: 'Kartal1903', avatar: 'K', msg: 'Aboubakar nerede ya?', likes: 71 },
];

const QUICK_REACTIONS = [
  { emoji: '⚽', label: 'GOOOL!', color: 'from-green-600 to-green-700' },
  { emoji: '🤬', label: 'HAKEM ŞAŞIRMIŞ!', color: 'from-red-600 to-red-700' },
  { emoji: '🔥', label: '', color: 'from-orange-500 to-orange-600' },
  { emoji: '😂', label: '', color: 'from-yellow-500 to-yellow-600' },
  { emoji: '😡', label: '', color: 'from-red-500 to-red-600' },
  { emoji: '👏', label: '', color: 'from-blue-500 to-blue-600' },
];

interface ExtendedMessage extends ChatMessage {
  likes_count?: number;
  is_pinned?: boolean;
  isFake?: boolean;
  fakeLikes?: number;
  fakeUser?: string;
  fakeAvatar?: string;
}

export default function ChatPanel({ onClose }: { onClose?: () => void }) {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<ExtendedMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());
  const [lastSendTime, setLastSendTime] = useState(0);
  const [lastMessage, setLastMessage] = useState('');
  const [spamWarning, setSpamWarning] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const subscriptionRef = useRef<any>(null);
  const fakeIntervalRef = useRef<any>(null);

  const getSupabase = () => {
    if (!supabaseRef.current) supabaseRef.current = createClient();
    return supabaseRef.current;
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Simulate online count
  useEffect(() => {
    const base = 847 + Math.floor(Math.random() * 2000);
    setOnlineCount(base);
    const interval = setInterval(() => {
      setOnlineCount(prev => prev + Math.floor(Math.random() * 21) - 10);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Initialize
  useEffect(() => {
    const init = async () => {
      try {
        const supabase = getSupabase();
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          setUser(authUser);
          const roomsList = await getChatRooms();
          setRooms(roomsList);
          if (roomsList.length > 0) {
            setSelectedRoom(roomsList[0]);
            await loadMessages(roomsList[0].id);
            await loadPinnedMessages(roomsList[0].id);
          }
        }
      } catch (err) {
        console.error('Chat init error:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const loadMessages = async (roomId: string) => {
    try {
      const msgs = await getMessages(roomId, 50);
      setMessages(msgs);
    } catch (err) {
      console.error('Load messages error:', err);
    }
  };

  const loadPinnedMessages = async (roomId: string) => {
    try {
      const pinned = await getPinnedMessages(roomId);
      setPinnedMessages(pinned);
    } catch (err) {
      console.error('Load pinned error:', err);
    }
  };

  // Fake activity system
  useEffect(() => {
    if (messages.length > 0 || !selectedRoom) return;

    let fakeIndex = 0;
    const addFakeMessage = () => {
      const fake = FAKE_MESSAGES[fakeIndex % FAKE_MESSAGES.length];
      const fakeMsg: ExtendedMessage = {
        id: `fake-${Date.now()}-${fakeIndex}`,
        room_id: selectedRoom?.id || '',
        user_id: 'fake',
        user_name: fake.user,
        user_avatar: fake.avatar,
        content: fake.msg,
        created_at: new Date().toISOString(),
        isFake: true,
        fakeLikes: fake.likes,
        fakeUser: fake.user,
        fakeAvatar: fake.avatar,
      };
      setMessages(prev => [...prev.slice(-30), fakeMsg]);
      fakeIndex++;
    };

    // Add initial batch
    for (let i = 0; i < 5; i++) {
      const fake = FAKE_MESSAGES[i];
      const fakeMsg: ExtendedMessage = {
        id: `fake-init-${i}`,
        room_id: selectedRoom?.id || '',
        user_id: 'fake',
        user_name: fake.user,
        user_avatar: fake.avatar,
        content: fake.msg,
        created_at: new Date(Date.now() - (5 - i) * 30000).toISOString(),
        isFake: true,
        fakeLikes: fake.likes,
        fakeUser: fake.user,
        fakeAvatar: fake.avatar,
      };
      setMessages(prev => [...prev, fakeMsg]);
    }

    fakeIntervalRef.current = setInterval(addFakeMessage, 4000 + Math.random() * 6000);
    return () => { if (fakeIntervalRef.current) clearInterval(fakeIntervalRef.current); };
  }, [messages.length, selectedRoom]);

  // Real-time subscription
  useEffect(() => {
    if (!selectedRoom || !user) return;
    const supabase = getSupabase();
    if (subscriptionRef.current) subscriptionRef.current.unsubscribe();

    subscriptionRef.current = supabase
      .channel(`chat_v2:${selectedRoom.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${selectedRoom.id}`,
      }, (payload: { new: ExtendedMessage }) => {
        // Clear fake messages when real ones come in
        setMessages(prev => {
          const realMessages = prev.filter(m => !m.isFake);
          return [...realMessages, payload.new];
        });
        if (fakeIntervalRef.current) {
          clearInterval(fakeIntervalRef.current);
          fakeIntervalRef.current = null;
        }
      })
      .subscribe();

    return () => { if (subscriptionRef.current) subscriptionRef.current.unsubscribe(); };
  }, [selectedRoom, user]);

  // Handle room change
  const handleSelectRoom = async (room: ChatRoom) => {
    setSelectedRoom(room);
    setMessages([]);
    await loadMessages(room.id);
    await loadPinnedMessages(room.id);
  };

  // Anti-spam + send message
  const handleSendMessage = async (content?: string) => {
    const text = (content || messageInput).trim();
    if (!text || !selectedRoom || !user || sending) return;

    // Rate limit: 3 seconds
    const now = Date.now();
    if (now - lastSendTime < 3000) {
      setSpamWarning('Çok hızlı! 3 saniye bekleyin.');
      setTimeout(() => setSpamWarning(''), 2000);
      return;
    }

    // Duplicate check
    if (text === lastMessage) {
      setSpamWarning('Aynı mesajı tekrar gönderemezsiniz.');
      setTimeout(() => setSpamWarning(''), 2000);
      return;
    }

    try {
      setSending(true);
      const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonim';
      const avatar = userName.charAt(0).toUpperCase();

      await sendMessage(selectedRoom.id, user.id, userName, avatar, text);
      if (!content) setMessageInput('');
      setLastSendTime(now);
      setLastMessage(text);
    } catch (err) {
      console.error('Send error:', err);
    } finally {
      setSending(false);
    }
  };

  // Quick reaction send
  const handleQuickReaction = (emoji: string, label: string) => {
    const text = label ? `${emoji} ${label}` : emoji;
    handleSendMessage(text);
  };

  // Like toggle
  const handleLike = async (msgId: string) => {
    if (!user) return;
    try {
      const result = await toggleLike(msgId, user.id);
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, likes_count: result.newCount } : m
      ));
      setUserLikes(prev => {
        const newSet = new Set(prev);
        if (result.liked) newSet.add(msgId);
        else newSet.delete(msgId);
        return newSet;
      });
    } catch (err) {
      console.error('Like error:', err);
    }
  };

  const formatTime = (dateStr: string): string => {
    try {
      return new Date(dateStr).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const getAvatarColor = (name: string): string => {
    const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500', 'bg-teal-500'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  if (loading) {
    return (
      <div className="flex flex-col bg-[#1a1a2e] rounded-xl border border-white/10 overflow-hidden" style={{ height: '600px' }}>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-gray-400 text-sm">Sohbet yükleniyor...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col bg-[#1a1a2e] rounded-xl border border-white/10 overflow-hidden" style={{ height: '600px' }}>
        <div className="p-4 border-b border-white/10 bg-[#16162a]">
          <h3 className="font-bold text-white text-center">CANLI SOHBET</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-sm">Sohbet için giriş yapın</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-[#1a1a2e] rounded-xl border border-white/10 overflow-hidden" style={{ height: '600px' }}>
      {/* Header */}
      <div className="p-3 border-b border-white/10 bg-[#16162a] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-red-500 text-lg">●</span>
          <h3 className="font-bold text-white text-sm tracking-wide">CANLI SOHBET</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="text-gray-400 hover:text-white transition-colors text-lg px-1">•••</button>
            {showMenu && (
              <div className="absolute right-0 top-8 bg-[#0f0f23] border border-white/10 rounded-lg shadow-xl z-50 w-40 py-1">
                {rooms.map(room => (
                  <button
                    key={room.id}
                    onClick={() => { handleSelectRoom(room); setShowMenu(false); }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors ${selectedRoom?.id === room.id ? 'text-red-400 bg-white/5' : 'text-gray-300 hover:bg-white/5'}`}
                  >
                    {room.emoji} {room.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-lg">✕</button>
          )}
        </div>
      </div>

      {/* Online count bar */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 px-3 py-1.5 text-center">
        <span className="text-white text-xs font-bold">
          🔴 {onlineCount.toLocaleString('tr-TR')} KİŞİ SOHBETTE 🔥
        </span>
      </div>

      {/* Room selector (compact) */}
      {rooms.length > 1 && (
        <div className="px-3 pt-2 pb-1 flex gap-1 overflow-x-auto">
          {rooms.slice(0, 4).map(room => (
            <button
              key={room.id}
              onClick={() => handleSelectRoom(room)}
              className={`px-2 py-1 rounded text-xs whitespace-nowrap transition-all ${
                selectedRoom?.id === room.id
                  ? 'bg-red-600 text-white font-bold'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {room.emoji} {room.name}
            </button>
          ))}
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1" style={{ scrollBehavior: 'smooth' }}>
        {/* Pinned messages */}
        {pinnedMessages.length > 0 && (
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-yellow-400 text-xs">📌</span>
              <span className="text-yellow-400 text-xs font-bold tracking-wider">SABİT MESAJ</span>
              <div className="flex-1 h-px bg-yellow-400/20" />
            </div>
            {pinnedMessages.map(msg => (
              <div key={msg.id} className="bg-yellow-400/5 border border-yellow-400/20 rounded-lg p-2 mb-1">
                <div className="flex items-start gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${getAvatarColor(msg.user_name)}`}>
                    {msg.user_avatar || msg.user_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-yellow-300 text-xs">{msg.user_name}</span>
                    </div>
                    <p className="text-gray-200 text-xs break-words">{msg.content}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-red-400 text-xs">❤️</span>
                    <span className="text-red-400 text-xs font-bold">{msg.likes_count || 0}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Regular messages */}
        {messages.map(msg => (
          <div key={msg.id} className="flex items-start gap-2 py-1 group hover:bg-white/5 rounded px-1 transition-colors">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${getAvatarColor(msg.user_name)}`}>
              {msg.user_avatar || msg.user_name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-bold text-sm" style={{ color: msg.isFake ? '#f59e0b' : '#ef4444' }}>
                {msg.user_name}
              </span>
              <span className="text-gray-500 text-xs ml-2">{formatTime(msg.created_at)}</span>
              <p className="text-gray-200 text-sm break-words">{msg.content}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!msg.isFake ? (
                <button
                  onClick={() => handleLike(msg.id)}
                  className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded transition-all ${
                    userLikes.has(msg.id) ? 'text-red-400' : 'text-gray-600 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <span className="text-xs">❤️</span>
                  {(msg.likes_count || 0) > 0 && (
                    <span className="text-xs font-bold text-red-400">{msg.likes_count}</span>
                  )}
                </button>
              ) : (
                <div className="flex items-center gap-0.5 px-1.5">
                  <span className="text-xs">❤️</span>
                  <span className="text-xs font-bold text-red-400">{msg.fakeLikes}</span>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Reactions */}
      <div className="px-3 py-2 border-t border-white/10 flex gap-1 flex-wrap">
        {QUICK_REACTIONS.map((reaction, idx) => (
          <button
            key={idx}
            onClick={() => handleQuickReaction(reaction.emoji, reaction.label)}
            className={`bg-gradient-to-r ${reaction.color} px-2 py-1 rounded-lg text-white text-xs font-bold hover:brightness-110 active:scale-95 transition-all flex items-center gap-1`}
          >
            <span>{reaction.emoji}</span>
            {reaction.label && <span>{reaction.label}</span>}
          </button>
        ))}
      </div>

      {/* Spam warning */}
      {spamWarning && (
        <div className="px-3 py-1 bg-red-900/50 text-red-300 text-xs text-center">
          ⚠️ {spamWarning}
        </div>
      )}

      {/* Message Input */}
      <div className="p-3 border-t border-white/10 bg-[#16162a]">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Mesajını yaz..."
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            disabled={sending}
            maxLength={500}
            className="flex-1 bg-[#0f0f23] text-white text-sm rounded-lg px-3 py-2 border border-white/10 placeholder-gray-500 focus:outline-none focus:border-red-500/50 disabled:opacity-50"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={sending || !messageInput.trim()}
            className="w-9 h-9 bg-red-600 text-white rounded-lg flex items-center justify-center hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors active:scale-95"
          >
            <span className="text-sm">▶</span>
          </button>
        </div>
      </div>

      {/* Sponsor Footer */}
      <div className="px-3 py-2 bg-gradient-to-r from-[#0f0f23] to-[#16162a] border-t border-white/10 text-center">
        <a href="https://www.nesine.com" target="_blank" rel="noopener noreferrer" className="text-xs text-yellow-400/80 hover:text-yellow-300 transition-colors font-medium">
          💬 SOHBET SPONSORU: <span className="font-bold">NESİNE.COM</span>
        </a>
      </div>
    </div>
  );
}
