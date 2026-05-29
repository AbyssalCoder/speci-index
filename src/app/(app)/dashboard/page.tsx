'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Flame, Trophy, TrendingUp, Zap, ChevronRight } from 'lucide-react';
import { GlassCard, Button, ProgressBar, Skeleton } from '@/components/ui';
import { SpeciesCard } from '@/components/species/species-card';
import { useAppStore } from '@/stores/app-store';
import { formatNumber, calculateLevel } from '@/lib/utils';
import Link from 'next/link';

export default function DashboardPage() {
  const user = useAppStore((s) => s.user);
  const setCaptureOpen = useAppStore((s) => s.setCaptureOpen);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [recentDiscoveries, setRecentDiscoveries] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, collectionRes] = await Promise.all([
          fetch('/api/auth/profile'),
          fetch('/api/collection?sort=date'),
        ]);
        const profile = await profileRes.json();
        const collection = await collectionRes.json();

        if (profile.success) {
          useAppStore.getState().setUser(profile.data);
        }
        if (collection.success) {
          setRecentDiscoveries(collection.data.slice(0, 6));
          useAppStore.getState().setCollection(collection.data);
        }
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const levelInfo = user ? calculateLevel(user.xp) : null;

  return (
    <div className="space-y-6">
      {/* Welcome & Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <GlassCard className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-gray-400 text-sm">Welcome back,</p>
                <h2 className="text-xl font-display font-bold text-white">
                  {user?.displayName ?? 'Explorer'}
                </h2>
              </div>
              <div className="text-right">
                <p className="text-2xl font-display font-bold text-brand-400">
                  {formatNumber(user?.totalPoints ?? 0)}
                </p>
                <p className="text-xs text-gray-500">Total Points</p>
              </div>
            </div>

            {/* Level Progress */}
            {levelInfo && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-white">
                    Level {levelInfo.level}
                  </span>
                  <span className="text-xs text-gray-500">
                    {Math.round(levelInfo.progress * 100)}%
                  </span>
                </div>
                <ProgressBar value={levelInfo.progress * 100} color="brand" />
              </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 rounded-xl bg-white/5">
                <p className="text-lg font-bold text-white">{user?.speciesCount ?? 0}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Species</p>
              </div>
              <div className="text-center p-2 rounded-xl bg-white/5">
                <p className="text-lg font-bold text-white">{user?.level ?? 1}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Level</p>
              </div>
              <div className="text-center p-2 rounded-xl bg-white/5">
                <p className="text-lg font-bold text-white">{formatNumber(user?.totalPoints ?? 0)}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Points</p>
              </div>
            </div>
          </GlassCard>
        )}
      </motion.div>

      {/* Quick Capture */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Button
          size="xl"
          className="w-full"
          onClick={() => setCaptureOpen(true)}
        >
          <Camera className="h-5 w-5" />
          Discover a Species
          <Zap className="h-4 w-4 text-yellow-300" />
        </Button>
      </motion.div>

      {/* Quick Links */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 gap-3"
      >
        <Link href="/leaderboard">
          <GlassCard className="p-4 hover:bg-white/10 transition-colors cursor-pointer">
            <Trophy className="h-5 w-5 text-amber-400 mb-2" />
            <p className="text-sm font-semibold text-white">Leaderboard</p>
            <p className="text-xs text-gray-500">See rankings</p>
          </GlassCard>
        </Link>
        <Link href="/map">
          <GlassCard className="p-4 hover:bg-white/10 transition-colors cursor-pointer">
            <TrendingUp className="h-5 w-5 text-green-400 mb-2" />
            <p className="text-sm font-semibold text-white">Explore Map</p>
            <p className="text-xs text-gray-500">Find species</p>
          </GlassCard>
        </Link>
      </motion.div>

      {/* Recent Discoveries */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold text-white">Recent Discoveries</h3>
          <Link href="/collection" className="text-xs text-brand-400 flex items-center gap-1">
            View All <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="aspect-[3/4]" />
            ))}
          </div>
        ) : recentDiscoveries.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {recentDiscoveries.map((d: any) => (
              <SpeciesCard
                key={d.id}
                imageUrl={d.imageUrl}
                commonName={d.species.commonName}
                scientificName={d.species.scientificName}
                rarityTier={d.species.rarityTier}
                rarityPoints={d.species.rarityPoints}
                conservationStatus={d.species.conservationStatus}
                category={d.species.category}
              />
            ))}
          </div>
        ) : (
          <GlassCard className="p-8 text-center">
            <Flame className="h-10 w-10 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No discoveries yet</p>
            <p className="text-xs text-gray-600 mt-1">Take your first photo to start!</p>
          </GlassCard>
        )}
      </motion.div>
    </div>
  );
}
