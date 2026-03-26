'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { getChatRooms, getMessages, sendMessage, toggleLike, getPinnedMessages, toggleReaction, getReactionCounts } from '@/lib/chat';
import type { ChatRoom, ChatMessage, ReactionCount } from '@/types';
import { addXp, XP_ACTIONS, awardBadge, getUserProfile, createPoll, getActivePolls, votePoll, getPollVotes, getUserVote, type Poll } from '@/lib/gamification';

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

// Sort rooms: general first, then teams, then channels
function sortRooms(rooms: ChatRoom[]): ChatRoom[] {
  const order: Record<string, number> = { general: 0, team: 1, channel: 2 };
  return [...rooms].sort((a, b) => (order[a.type] ?? 3) - (order[b.type] ?? 3));
}

const MESSAGE_REACTIONS = ['⚽', '🔥', '😂', '😡', '👏', '💀'];

interface ExtendedMessage extends ChatMessage {
  likes_count?: number;
  is_pinned?: boolean;
  isFake?: boolean;
  fakeLikes?: number;
  fakeUser?: string;
  fakeAvatar?: string;
  reactionCounts?: ReactionCount[];
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
  const [roomLoading, setRoomLoading] = useState(false);
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());
  const [lastSendTime, setLastSendTime] = useState(0);
  const [lastMessage, setLastMessage] = useState('');
  const [spamWarning, setSpamWarning] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState<string | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, ReactionCount[]>>({});
  const [xpToast, setXpToast] = useState<string | null>(null);
  const [msgCount, setMsgCount] = useState(0);
  // Poll states
  const [userLevel, setUserLevel] = useState(1);
  const [showPollForm, setShowPollForm] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [creatingPoll, setCreatingPoll] = useState(false);
  const [activePolls, setActivePolls] = useState<(Poll & { votes: Record<number, number>; userVote: number | null; totalVotes: number })[]>([]);
  const [showPolls, setShowPolls] = useState(false);
  const [votingPollId, setVotingPollId] = useState<string | null>(null);
  const POLL_MIN_LEVEL = 3; // Fanatik seviyesi
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const subscriptionRef = useRef<any>(null);
  const fakeIntervalRef = useRef<any>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const getSupabase = () => {
    if (!supabaseRef.current) supabaseRef.current = createClient();
    return supabaseRef.current;
  };

  // Poll helpers
  const loadRoomPolls = useCallback(async (roomId: string, uid?: string) => {
    try {
      const polls = await getActivePolls(roomId);
      const enriched = await Promise.all(polls.map(async (p) => {
        const [votes, uv] = await Promise.all([
          getPollVotes(p.id),
          uid ? getUserVote(p.id, uid) : Promise.resolve(null),
        ]);
        const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
        return { ...p, votes, userVote: uv, totalVotes };
      }));
      setActivePolls(enriched);
      if (enriched.length > 0) setShowPolls(true);
    } catch {}
  }, []);

  const handleCreatePoll = async () => {
    if (!user || !selectedRoom || !pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) return;
    setCreatingPoll(true);
    try {
      await createPoll(selectedRoom.id, user.id, pollQuestion.trim(), pollOptions.filter(o => o.trim()));
      setPollQuestion('');
      setPollOptions(['', '']);
      setShowPollForm(false);
      await loadRoomPolls(selectedRoom.id, user.id);
      // XP ver
      try { await addXp(user.id, XP_ACTIONS.CREATE_POLL.action, XP_ACTIONS.CREATE_POLL.amount); } catch {}
    } catch (err) {
      console.error('Poll create error:', err);
    } finally {
      setCreatingPoll(false);
    }
  };

  const handleVotePoll = async (pollId: string, optionIndex: number) => {
    if (!user || !selectedRoom) return;
    setVotingPollId(pollId);
    try {
      await votePoll(pollId, user.id, optionIndex);
      await loadRoomPolls(selectedRoom.id, user.id);
      try { await addXp(user.id, XP_ACTIONS.VOTE_POLL.action, XP_ACTIONS.VOTE_POLL.amount); } catch {}
    } catch (err: any) {
      console.error('Vote error:', err.message);
    } finally {
      setVotingPollId(null);
    }
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  // Simulate online count
  useEffect(() => {
    const base = 847 + Math.floor(Math.random() * 2000);
    setOnlineCount(base);
    const interval = setInterval(() => {
      setOnlineCount(prev => prev + Math.floor(Math.random() * 21) - 10);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Initialize — misafirler de odaları ve mesajları görebilir
  useEffect(() => {
    const init = async () => {
      try {
        const supabase = getSupabase();
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          setUser(authUser);
          // Kullanıcı seviyesini yükle
          try {
            const profile = await getUserProfile(authUser.id);
            if (profile) setUserLevel(profile.level || 1);
          } catch {}
        }

        // Odaları ve mesajları herkes görebilir
        const roomsList = await getChatRooms();
        const sorted = sortRooms(roomsList);
        setRooms(sorted);
        if (sorted.length > 0) {
          const generalRoom = sorted.find((r) => r.type === 'general') || sorted[0];
          setSelectedRoom(generalRoom);
          await loadMessages(generalRoom.id);
          await loadPinnedMessages(generalRoom.id);
          if (authUser) await loadRoomPolls(generalRoom.id, authUser.id);
        }

        // Auth state değişikliklerini dinle
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.user) {
            setUser(session.user);
          }
        });
        return () => subscription.unsubscribe();
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
      loadReactions(msgs);
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
    if (selectedRoom?.id === room.id) return;
    setRoomLoading(true);
    setSelectedRoom(room);
    setMessages([]);
    setPinnedMessages([]);
    // Clear fake interval
    if (fakeIntervalRef.current) {
      clearInterval(fakeIntervalRef.current);
      fakeIntervalRef.current = null;
    }
    try {
      await loadMessages(room.id);
      await loadPinnedMessages(room.id);
      if (user) await loadRoomPolls(room.id, user.id);
    } catch (err) {
      console.error('Room switch error:', err);
    } finally {
      setRoomLoading(false);
    }
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

      // XP for sending message
      const newCount = msgCount + 1;
      setMsgCount(newCount);
      try {
        await addXp(user.id, XP_ACTIONS.SEND_MESSAGE.action, XP_ACTIONS.SEND_MESSAGE.amount);
        showXpToast('+5 XP');
        // Badge checks
        if (newCount === 1) await awardBadge(user.id, 'first_message');
        if (newCount === 50) await awardBadge(user.id, 'msg_50');
        if (newCount === 100) await awardBadge(user.id, 'msg_100');
        // Night owl / early bird badges
        const hour = new Date().getHours();
        if (hour >= 2 && hour < 5) await awardBadge(user.id, 'night_owl');
        if (hour >= 5 && hour < 7) await awardBadge(user.id, 'early_bird');
      } catch (e) { /* XP non-critical */ }
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

  // Handle emoji reaction on message
  const handleReaction = async (msgId: string, emoji: string) => {
    if (!user || msgId.startsWith('fake')) return;
    try {
      const result = await toggleReaction(msgId, user.id, emoji);
      // Update local reaction state
      setMessageReactions(prev => {
        const current = prev[msgId] || [];
        const existing = current.find(r => r.emoji === emoji);
        if (result.added) {
          if (existing) {
            return { ...prev, [msgId]: current.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, user_reacted: true } : r) };
          } else {
            return { ...prev, [msgId]: [...current, { emoji, count: 1, user_reacted: true }] };
          }
        } else {
          if (existing && existing.count <= 1) {
            return { ...prev, [msgId]: current.filter(r => r.emoji !== emoji) };
          }
          return { ...prev, [msgId]: current.map(r => r.emoji === emoji ? { ...r, count: r.count - 1, user_reacted: false } : r) };
        }
      });
      setReactionPickerMsgId(null);
    } catch (err) {
      console.error('Reaction error:', err);
    }
  };

  // Load reactions for visible messages
  const loadReactions = async (msgs: ExtendedMessage[]) => {
    if (!user) return;
    const realMsgIds = msgs.filter(m => !m.isFake).map(m => m.id);
    if (realMsgIds.length === 0) return;
    try {
      const counts = await getReactionCounts(realMsgIds, user.id);
      setMessageReactions(prev => ({ ...prev, ...counts }));
    } catch (err) {
      console.error('Load reactions error:', err);
    }
  };

  // Show XP toast
  const showXpToast = (text: string) => {
    setXpToast(text);
    setTimeout(() => setXpToast(null), 2000);
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

  // Get important rooms for tabs: general + teams
  const tabRooms = rooms.filter(r => r.type === 'general' || r.type === 'team');
  // Channel rooms for dropdown only
  const channelRooms = rooms.filter(r => r.type === 'channel');

  if (loading) {
    return (
      <div className="flex flex-col bg-[#1a1a2e] rounded-xl border border-white/10" style={{ height: '600px' }}>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-gray-400 text-sm">Sohbet yükleniyor...</div>
        </div>
      </div>
    );
  }

  const isGuest = !user;

  // Misafirler mesajları görebilir ama yazamaz — aşağıda input yerine üye ol CTA gösterilir

  return (
    <div className="flex flex-col bg-[#1a1a2e] rounded-xl border border-white/10 relative h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-white/10 bg-[#16162a] rounded-t-xl flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-red-500 text-lg shrink-0">●</span>
          <div className="min-w-0">
            <h3 className="font-bold text-white text-sm tracking-wide truncate">
              {selectedRoom ? `${selectedRoom.emoji} ${selectedRoom.name}` : 'CANLI SOHBET'}
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0" ref={menuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="text-gray-400 hover:text-white transition-colors text-lg px-1"
          >
            •••
          </button>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-lg">✕</button>
          )}
        </div>
      </div>

      {/* Dropdown menu - rendered outside overflow container */}
      {showMenu && (
        <div
          className="absolute right-2 top-12 bg-[#0f0f23] border border-white/10 rounded-lg shadow-2xl w-52 py-1 max-h-72 overflow-y-auto"
          style={{ zIndex: 9999 }}
        >
          {/* General + Team rooms */}
          {tabRooms.length > 0 && (
            <>
              <div className="px-3 py-1 text-[10px] text-gray-500 uppercase font-bold">Odalar</div>
              {tabRooms.map(room => (
                <button
                  key={room.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectRoom(room);
                    setShowMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                    selectedRoom?.id === room.id
                      ? 'text-red-400 bg-red-500/10 font-bold'
                      : 'text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {selectedRoom?.id === room.id && '● '}{room.emoji} {room.name}
                </button>
              ))}
            </>
          )}
          {/* Channel rooms */}
          {channelRooms.length > 0 && (
            <>
              <div className="px-3 py-1 mt-1 text-[10px] text-gray-500 uppercase font-bold border-t border-white/5">Kanal Odaları</div>
              {channelRooms.map(room => (
                <button
                  key={room.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectRoom(room);
                    setShowMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                    selectedRoom?.id === room.id
                      ? 'text-red-400 bg-red-500/10 font-bold'
                      : 'text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {selectedRoom?.id === room.id && '● '}{room.emoji} {room.name}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Online count bar */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 px-3 py-1.5 text-center shrink-0">
        <span className="text-white text-xs font-bold">
          🔴 {onlineCount.toLocaleString('tr-TR')} KİŞİ SOHBETTE 🔥
        </span>
      </div>

      {/* Room selector tabs: general + teams */}
      {tabRooms.length > 0 && (
        <div className="px-3 pt-2 pb-1 flex gap-1 overflow-x-auto shrink-0">
          {tabRooms.map(room => (
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
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 min-h-0" style={{ scrollBehavior: 'smooth' }}>
        {roomLoading && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin text-red-400 text-lg mr-2">↻</div>
            <span className="text-gray-400 text-xs">Oda yükleniyor...</span>
          </div>
        )}
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
        {messages.map(msg => {
          const reactions = messageReactions[msg.id] || [];
          return (
            <div key={msg.id} className="py-1 group hover:bg-white/5 rounded px-1 transition-colors relative">
              <div className="flex items-start gap-2">
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
                    <>
                      {/* Reaction trigger */}
                      <button
                        onClick={() => setReactionPickerMsgId(reactionPickerMsgId === msg.id ? null : msg.id)}
                        className="text-gray-600 opacity-0 group-hover:opacity-100 hover:text-white text-xs px-1 transition-all"
                        title="Emoji ekle"
                      >
                        😊
                      </button>
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
                    </>
                  ) : (
                    <div className="flex items-center gap-0.5 px-1.5">
                      <span className="text-xs">❤️</span>
                      <span className="text-xs font-bold text-red-400">{msg.fakeLikes}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Reaction picker popup */}
              {reactionPickerMsgId === msg.id && !msg.isFake && (
                <div className="absolute right-0 top-0 flex items-center gap-0.5 bg-[#0f0f23] border border-white/10 rounded-full px-1.5 py-0.5 shadow-xl z-50">
                  {MESSAGE_REACTIONS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => handleReaction(msg.id, emoji)}
                      className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-sm transition-all hover:scale-125 active:scale-90"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {/* Existing reactions display */}
              {reactions.length > 0 && (
                <div className="flex items-center gap-1 ml-9 mt-0.5 flex-wrap">
                  {reactions.map(r => (
                    <button
                      key={r.emoji}
                      onClick={() => handleReaction(msg.id, r.emoji)}
                      className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] transition-all ${
                        r.user_reacted
                          ? 'bg-red-500/20 border border-red-500/30 text-white'
                          : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      <span>{r.emoji}</span>
                      <span className="font-bold">{r.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Active Polls in Chat Room */}
      {!isGuest && activePolls.length > 0 && (
        <div className="border-t border-white/10 shrink-0">
          <button
            onClick={() => setShowPolls(!showPolls)}
            className="w-full px-3 py-1.5 flex items-center justify-between text-xs hover:bg-white/5 transition-colors"
          >
            <span className="text-yellow-400 font-bold">📊 Aktif Anket ({activePolls.length})</span>
            <span className="text-gray-500">{showPolls ? '▲' : '▼'}</span>
          </button>
          {showPolls && (
            <div className="px-3 pb-2 space-y-2 max-h-48 overflow-y-auto">
              {activePolls.map(poll => {
                const opts = Array.isArray(poll.options) ? poll.options : [];
                const hasVoted = poll.userVote !== null;
                return (
                  <div key={poll.id} className="bg-white/[0.03] rounded-lg p-2 border border-white/5">
                    <p className="text-xs text-white font-bold mb-1.5">{poll.question}</p>
                    <div className="space-y-1">
                      {opts.map((opt: string, idx: number) => {
                        const voteCount = poll.votes[idx] || 0;
                        const pct = poll.totalVotes > 0 ? (voteCount / poll.totalVotes) * 100 : 0;
                        const isUserVote = poll.userVote === idx;
                        return (
                          <button
                            key={idx}
                            onClick={() => !hasVoted && handleVotePoll(poll.id, idx)}
                            disabled={hasVoted || votingPollId === poll.id}
                            className={`w-full text-left rounded overflow-hidden relative transition-all ${hasVoted ? 'cursor-default' : 'hover:brightness-110 active:scale-[0.99] cursor-pointer'} ${isUserVote ? 'ring-1 ring-yellow-500/50' : ''}`}
                          >
                            <div className="absolute inset-0 bg-white/5">
                              <div className={`h-full transition-all duration-500 ${hasVoted ? 'bg-yellow-500/25' : ''}`} style={{ width: hasVoted ? `${pct}%` : '0%' }} />
                            </div>
                            <div className="relative px-2 py-1 flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                {!hasVoted && <div className="w-2 h-2 rounded-full bg-yellow-500/60" />}
                                {isUserVote && <span className="text-[10px] text-yellow-400">✓</span>}
                                <span className="text-[11px] text-white">{opt}</span>
                              </div>
                              {hasVoted && (
                                <span className="text-[10px] text-gray-400">{pct.toFixed(0)}% ({voteCount})</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1">{poll.totalVotes} oy</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Poll Creation Form */}
      {showPollForm && (
        <div className="px-3 py-2 border-t border-white/10 bg-[#1a1a2e] shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-yellow-400 font-bold">📊 Yeni Anket</span>
            <button onClick={() => setShowPollForm(false)} className="text-gray-500 hover:text-white text-xs">✕</button>
          </div>
          <input
            type="text"
            placeholder="Soru yaz... (örn: Bu maçı kim kazanır?)"
            value={pollQuestion}
            onChange={e => setPollQuestion(e.target.value)}
            maxLength={200}
            className="w-full bg-[#0f0f23] text-white text-xs rounded-lg px-2.5 py-1.5 border border-white/10 placeholder-gray-500 focus:outline-none focus:border-yellow-500/50"
          />
          {pollOptions.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-yellow-500/60 shrink-0" />
              <input
                type="text"
                placeholder={`Seçenek ${idx + 1}`}
                value={opt}
                onChange={e => { const n = [...pollOptions]; n[idx] = e.target.value; setPollOptions(n); }}
                maxLength={50}
                className="flex-1 bg-[#0f0f23] text-white text-[11px] rounded px-2 py-1 border border-white/10 placeholder-gray-600 focus:outline-none focus:border-yellow-500/50"
              />
              {pollOptions.length > 2 && (
                <button onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))} className="text-gray-600 hover:text-red-400 text-[10px]">✕</button>
              )}
            </div>
          ))}
          <div className="flex items-center gap-2">
            {pollOptions.length < 5 && (
              <button onClick={() => setPollOptions([...pollOptions, ''])} className="text-[10px] text-gray-500 hover:text-white">+ Seçenek</button>
            )}
            <div className="flex-1" />
            <button
              onClick={handleCreatePoll}
              disabled={creatingPoll || !pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}
              className="px-3 py-1 rounded bg-yellow-600 text-white text-[11px] font-bold hover:bg-yellow-700 disabled:opacity-30 transition-colors"
            >
              {creatingPoll ? '...' : 'Yayınla'}
            </button>
          </div>
        </div>
      )}

      {/* Quick Reactions — sadece üyeler */}
      {!isGuest && (
        <div className="px-3 py-2 border-t border-white/10 flex gap-1 flex-wrap shrink-0">
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
      )}

      {/* Spam warning */}
      {spamWarning && (
        <div className="px-3 py-1 bg-red-900/50 text-red-300 text-xs text-center shrink-0">
          ⚠️ {spamWarning}
        </div>
      )}

      {/* Message Input — sadece üyeler mesaj gönderebilir */}
      <div className="p-3 border-t border-white/10 bg-[#16162a] shrink-0">
        {isGuest ? (
          <div className="flex items-center justify-center gap-2 py-1">
            <span className="text-gray-500 text-xs">Mesaj göndermek için</span>
            <button
              onClick={async () => {
                const supabase = getSupabase();
                await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: { redirectTo: `${window.location.origin}/auth/callback` },
                });
              }}
              className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-lg font-medium transition-colors"
            >
              Giriş Yap
            </button>
          </div>
        ) : (
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
            {/* Anket oluştur butonu — Seviye 3+ (Fanatik) */}
            {userLevel >= POLL_MIN_LEVEL && (
              <button
                onClick={() => setShowPollForm(!showPollForm)}
                title={`Anket Oluştur (Seviye ${POLL_MIN_LEVEL}+)`}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors active:scale-95 ${showPollForm ? 'bg-yellow-600 text-white' : 'bg-white/10 text-yellow-400 hover:bg-white/15'}`}
              >
                <span className="text-sm">📊</span>
              </button>
            )}
            <button
              onClick={() => handleSendMessage()}
              disabled={sending || !messageInput.trim()}
              className="w-9 h-9 bg-red-600 text-white rounded-lg flex items-center justify-center hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors active:scale-95"
            >
              <span className="text-sm">▶</span>
            </button>
          </div>
        )}
      </div>

      {/* XP Toast */}
      {xpToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-green-600/90 text-white text-xs font-bold rounded-full animate-bounce shadow-lg z-50">
          {xpToast}
        </div>
      )}

      {/* Sponsor Footer */}
      <div className="px-3 py-2 bg-gradient-to-r from-[#0f0f23] to-[#16162a] border-t border-white/10 text-center rounded-b-xl shrink-0">
        <a href="https://www.nesine.com" target="_blank" rel="noopener noreferrer" className="text-xs text-yellow-400/80 hover:text-yellow-300 transition-colors font-medium">
          💬 SOHBET SPONSORU: <span className="font-bold">NESİNE.COM</span>
        </a>
      </div>
    </div>
  );
}
