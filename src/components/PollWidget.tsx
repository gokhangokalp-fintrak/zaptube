'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { createPoll, getActivePolls, votePoll, getPollVotes, getUserVote, type Poll } from '@/lib/gamification';

const POLL_COLORS = [
  'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
  'bg-purple-500', 'bg-pink-500', 'bg-orange-500', 'bg-teal-500',
];

interface PollWithVotes extends Poll {
  votes: Record<number, number>;
  userVote: number | null;
  totalVotes: number;
}

export default function PollWidget({ roomId }: { roomId?: string }) {
  const [polls, setPolls] = useState<PollWithVotes[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [creating, setCreating] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [votingId, setVotingId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      await loadPolls(user.id);
    };
    init();
  }, [roomId]);

  const loadPolls = async (uid: string) => {
    try {
      const activePolls = await getActivePolls(roomId);
      const pollsWithVotes: PollWithVotes[] = await Promise.all(
        activePolls.map(async (poll) => {
          const [votes, userVote] = await Promise.all([
            getPollVotes(poll.id),
            getUserVote(poll.id, uid),
          ]);
          const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
          return { ...poll, votes, userVote, totalVotes };
        })
      );
      setPolls(pollsWithVotes);
    } catch (err) {
      console.error('Load polls error:', err);
    }
  };

  const handleCreatePoll = async () => {
    if (!userId || !question.trim() || options.filter(o => o.trim()).length < 2) return;
    setCreating(true);
    try {
      const validOptions = options.filter(o => o.trim());
      await createPoll(roomId || null, userId, question.trim(), validOptions);
      setQuestion('');
      setOptions(['', '']);
      setShowCreate(false);
      await loadPolls(userId);
    } catch (err) {
      console.error('Create poll error:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleVote = async (pollId: string, optionIndex: number) => {
    if (!userId) return;
    setVotingId(pollId);
    try {
      await votePoll(pollId, userId, optionIndex);
      await loadPolls(userId);
    } catch (err: any) {
      console.error('Vote error:', err.message);
    } finally {
      setVotingId(null);
    }
  };

  const addOption = () => {
    if (options.length < 6) setOptions([...options, '']);
  };

  if (!userId) return null;

  return (
    <div className="bg-[#1a1a2e] rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <h3 className="text-sm font-bold text-white">Anketler</h3>
          {polls.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold">
              {polls.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="text-xs px-2.5 py-1 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition-colors active:scale-95"
        >
          {showCreate ? '✕' : '+ Anket Oluştur'}
        </button>
      </div>

      {/* Create Poll Form */}
      {showCreate && (
        <div className="p-4 border-b border-white/10 bg-white/[0.02]">
          <input
            type="text"
            placeholder="Soru yaz... (örn: Bu maçı kim kazanır?)"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            maxLength={200}
            className="w-full bg-[#0f0f23] text-white text-sm rounded-lg px-3 py-2 border border-white/10 placeholder-gray-500 focus:outline-none focus:border-red-500/50 mb-3"
          />
          <div className="space-y-2 mb-3">
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${POLL_COLORS[idx % POLL_COLORS.length]}`} />
                <input
                  type="text"
                  placeholder={`Seçenek ${idx + 1}`}
                  value={opt}
                  onChange={e => {
                    const newOpts = [...options];
                    newOpts[idx] = e.target.value;
                    setOptions(newOpts);
                  }}
                  maxLength={50}
                  className="flex-1 bg-[#0f0f23] text-white text-xs rounded-lg px-3 py-1.5 border border-white/10 placeholder-gray-600 focus:outline-none focus:border-red-500/50"
                />
                {options.length > 2 && (
                  <button
                    onClick={() => setOptions(options.filter((_, i) => i !== idx))}
                    className="text-gray-600 hover:text-red-400 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {options.length < 6 && (
              <button onClick={addOption} className="text-xs text-gray-500 hover:text-white transition-colors">
                + Seçenek ekle
              </button>
            )}
            <button
              onClick={handleCreatePoll}
              disabled={creating || !question.trim() || options.filter(o => o.trim()).length < 2}
              className="ml-auto px-4 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-30 transition-colors"
            >
              {creating ? 'Oluşturuluyor...' : 'Anketi Yayınla'}
            </button>
          </div>
        </div>
      )}

      {/* Active Polls */}
      <div className="p-3 space-y-3 max-h-96 overflow-y-auto">
        {polls.map(poll => {
          const opts = Array.isArray(poll.options) ? poll.options : [];
          const hasVoted = poll.userVote !== null;

          return (
            <div key={poll.id} className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
              <p className="text-sm text-white font-bold mb-3">{poll.question}</p>

              <div className="space-y-2">
                {opts.map((opt: string, idx: number) => {
                  const voteCount = poll.votes[idx] || 0;
                  const pct = poll.totalVotes > 0 ? (voteCount / poll.totalVotes) * 100 : 0;
                  const isUserVote = poll.userVote === idx;

                  return (
                    <button
                      key={idx}
                      onClick={() => !hasVoted && handleVote(poll.id, idx)}
                      disabled={hasVoted || votingId === poll.id}
                      className={`w-full text-left rounded-lg overflow-hidden transition-all relative ${
                        hasVoted
                          ? 'cursor-default'
                          : 'hover:brightness-110 active:scale-[0.99] cursor-pointer'
                      } ${isUserVote ? 'ring-1 ring-red-500/50' : ''}`}
                    >
                      {/* Background bar */}
                      <div className="absolute inset-0 bg-white/5">
                        <div
                          className={`h-full transition-all duration-700 ${
                            hasVoted ? POLL_COLORS[idx % POLL_COLORS.length] + ' opacity-30' : ''
                          }`}
                          style={{ width: hasVoted ? `${pct}%` : '0%' }}
                        />
                      </div>
                      {/* Content */}
                      <div className="relative px-3 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {!hasVoted && <div className={`w-2.5 h-2.5 rounded-full ${POLL_COLORS[idx % POLL_COLORS.length]}`} />}
                          {isUserVote && <span className="text-xs">✓</span>}
                          <span className="text-xs text-white">{opt}</span>
                        </div>
                        {hasVoted && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{voteCount} oy</span>
                            <span className="text-xs text-white font-bold">{pct.toFixed(0)}%</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-gray-500">
                  {poll.totalVotes} toplam oy
                </span>
                {hasVoted && (
                  <span className="text-[10px] text-green-400">✓ Oy verildi</span>
                )}
              </div>
            </div>
          );
        })}
        {polls.length === 0 && !showCreate && (
          <div className="text-center py-6">
            <p className="text-3xl mb-2">📊</p>
            <p className="text-xs text-gray-500">Henüz aktif anket yok</p>
            <p className="text-[10px] text-gray-600 mt-1">İlk anketi sen oluştur!</p>
          </div>
        )}
      </div>
    </div>
  );
}
