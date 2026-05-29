'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Award, Lock, Star } from 'lucide-react';
import { GlassCard, Skeleton } from '@/components/ui';
import { RarityBadge } from '@/components/species/species-card';
import { cn } from '@/lib/utils';
import type { AchievementInfo } from '@/types';

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<AchievementInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('ALL');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/achievements');
        const data = await res.json();
        if (data.success) setAchievements(data.data);
      } catch (err) {
        console.error('Achievements load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const categories = ['ALL', 'DISCOVERY', 'COLLECTION', 'EXPLORATION', 'SOCIAL', 'SEASONAL', 'SPECIAL'];
  const filtered = filter === 'ALL' ? achievements : achievements.filter((a) => a.category === filter);
  const unlockedCount = achievements.filter((a) => a.unlockedAt).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="h-6 w-6 text-amber-400" />
          <h1 className="text-2xl font-display font-bold text-white">Achievements</h1>
        </div>
        <span className="text-sm text-gray-400">
          {unlockedCount}/{achievements.length}
        </span>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filter === cat
                ? 'bg-brand-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            {cat === 'ALL' ? 'All' : cat.charAt(0) + cat.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((achievement, i) => {
            const isUnlocked = !!achievement.unlockedAt;
            return (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <GlassCard
                  className={cn(
                    'p-4 flex items-center gap-3',
                    !isUnlocked && 'opacity-50'
                  )}
                >
                  <div
                    className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center text-xl',
                      isUnlocked ? 'bg-amber-500/20' : 'bg-white/5'
                    )}
                  >
                    {isUnlocked ? (
                      <Star className="h-6 w-6 text-amber-400" />
                    ) : (
                      <Lock className="h-5 w-5 text-gray-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white truncate">
                        {achievement.name}
                      </p>
                      <RarityBadge tier={achievement.rarity} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{achievement.description}</p>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
