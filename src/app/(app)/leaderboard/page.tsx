'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Globe, Flag, Users, Medal, Crown, ChevronDown } from 'lucide-react';
import { GlassCard, Avatar, Skeleton, Badge } from '@/components/ui';
import { formatNumber } from '@/lib/utils';
import type { LeaderboardEntry } from '@/types';

type Scope = 'global' | 'country' | 'state' | 'friends';

export default function LeaderboardPage() {
  const [scope, setScope] = useState<Scope>('global');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ scope, pageSize: '50' });
        const res = await fetch(`/api/leaderboard?${params}`);
        const data = await res.json();
        if (data.success) {
          setEntries(data.data.items);
        }
      } catch (err) {
        console.error('Leaderboard load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [scope]);

  const scopeButtons: { value: Scope; label: string; icon: React.ReactNode }[] = [
    { value: 'global', label: 'Global', icon: <Globe className="h-4 w-4" /> },
    { value: 'country', label: 'Country', icon: <Flag className="h-4 w-4" /> },
    { value: 'state', label: 'State', icon: <Flag className="h-4 w-4" /> },
    { value: 'friends', label: 'Friends', icon: <Users className="h-4 w-4" /> },
  ];

  const getRankDisplay = (rank: number) => {
    if (rank === 1) return <Crown className="h-5 w-5 text-amber-400" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-300" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-700" />;
    return <span className="text-sm font-bold text-gray-500 w-5 text-center">{rank}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="h-6 w-6 text-amber-400" />
        <h1 className="text-2xl font-display font-bold text-white">Leaderboard</h1>
      </div>

      {/* Scope tabs */}
      <div className="flex gap-2">
        {scopeButtons.map((btn) => (
          <button
            key={btn.value}
            onClick={() => setScope(btn.value)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              scope === btn.value
                ? 'bg-brand-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            {btn.icon}
            {btn.label}
          </button>
        ))}
      </div>

      {/* Top 3 podium */}
      {!loading && entries.length >= 3 && (
        <div className="flex items-end justify-center gap-3 py-4">
          {/* 2nd */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center"
          >
            <Avatar src={entries[1]?.user.avatarUrl} alt={entries[1]?.user.displayName ?? ''} size="lg" />
            <p className="text-xs font-semibold text-white mt-2 truncate max-w-[80px]">{entries[1]?.user.displayName}</p>
            <p className="text-xs text-gray-400">{formatNumber(entries[1]?.totalPoints ?? 0)}</p>
            <div className="w-16 h-16 bg-gray-400/10 rounded-t-xl mt-2 flex items-center justify-center">
              <span className="text-lg font-bold text-gray-300">2</span>
            </div>
          </motion.div>

          {/* 1st */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center"
          >
            <div className="relative">
              <Crown className="h-6 w-6 text-amber-400 absolute -top-4 left-1/2 -translate-x-1/2" />
              <Avatar src={entries[0]?.user.avatarUrl} alt={entries[0]?.user.displayName ?? ''} size="xl" />
            </div>
            <p className="text-sm font-bold text-white mt-2 truncate max-w-[100px]">{entries[0]?.user.displayName}</p>
            <p className="text-xs text-brand-400">{formatNumber(entries[0]?.totalPoints ?? 0)}</p>
            <div className="w-20 h-24 bg-amber-500/10 rounded-t-xl mt-2 flex items-center justify-center">
              <span className="text-2xl font-bold text-amber-400">1</span>
            </div>
          </motion.div>

          {/* 3rd */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center"
          >
            <Avatar src={entries[2]?.user.avatarUrl} alt={entries[2]?.user.displayName ?? ''} size="lg" />
            <p className="text-xs font-semibold text-white mt-2 truncate max-w-[80px]">{entries[2]?.user.displayName}</p>
            <p className="text-xs text-gray-400">{formatNumber(entries[2]?.totalPoints ?? 0)}</p>
            <div className="w-16 h-12 bg-amber-800/10 rounded-t-xl mt-2 flex items-center justify-center">
              <span className="text-lg font-bold text-amber-700">3</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* Full list */}
      <GlassCard className="divide-y divide-white/5">
        {loading ? (
          Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="p-3">
              <Skeleton className="h-10 w-full" />
            </div>
          ))
        ) : (
          entries.map((entry, i) => (
            <motion.div
              key={entry.user.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors"
            >
              <div className="w-6 flex justify-center">
                {getRankDisplay(entry.rank)}
              </div>
              <Avatar src={entry.user.avatarUrl} alt={entry.user.displayName ?? ''} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {entry.user.displayName}
                </p>
                <p className="text-xs text-gray-500">
                  {entry.speciesCount} species
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-brand-400">
                  {formatNumber(entry.totalPoints)}
                </p>
              </div>
            </motion.div>
          ))
        )}
      </GlassCard>
    </div>
  );
}
