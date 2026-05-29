'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, LogOut, Camera, Award, MapPin, Calendar, Edit3 } from 'lucide-react';
import { GlassCard, Button, Avatar, ProgressBar, Badge } from '@/components/ui';
import { useAppStore } from '@/stores/app-store';
import { formatNumber, calculateLevel, formatDate } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const user = useAppStore((s) => s.user);
  const collection = useAppStore((s) => s.collection);
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      fetch('/api/auth/profile')
        .then((r) => r.json())
        .then((data) => {
          if (data.success) useAppStore.getState().setUser(data.data);
        })
        .catch(() => {});
    }
  }, [user]);

  const levelInfo = user ? calculateLevel(user.xp) : null;

  // Category breakdown
  const categoryStats = collection.reduce((acc: Record<string, number>, d: any) => {
    const cat = d.species?.category ?? 'OTHER';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    useAppStore.getState().setUser(null);
    router.push('/');
  };

  return (
    <div className="space-y-4">
      {/* Profile Header */}
      <GlassCard className="p-5">
        <div className="flex items-start gap-4">
          <Avatar src={user?.avatarUrl} alt={user?.displayName ?? 'U'} size="xl" />
          <div className="flex-1">
            <h2 className="text-xl font-display font-bold text-white">{user?.displayName}</h2>
            <p className="text-sm text-gray-400">@{user?.username}</p>
            {user?.bio && <p className="text-xs text-gray-500 mt-1">{user.bio}</p>}
            <div className="flex items-center gap-2 mt-2">
              {user?.country && (
                <Badge>
                  <MapPin className="h-3 w-3 mr-1" />
                  {user.country}
                </Badge>
              )}
              <Badge variant="info">Level {user?.level ?? 1}</Badge>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm">
            <Edit3 className="h-4 w-4" />
          </Button>
        </div>

        {/* Level Progress */}
        {levelInfo && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-400">
                Level {levelInfo.level}
              </span>
              <span className="text-xs text-gray-500">
                {user?.xp} / {user?.xp ? user.xp + levelInfo.xpForNext - Math.round(levelInfo.progress * levelInfo.xpForNext) : 0} XP
              </span>
            </div>
            <ProgressBar value={levelInfo.progress * 100} />
          </div>
        )}
      </GlassCard>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <GlassCard className="p-3 text-center">
          <p className="text-2xl font-display font-bold text-brand-400">
            {formatNumber(user?.totalPoints ?? 0)}
          </p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Points</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <p className="text-2xl font-display font-bold text-green-400">
            {user?.speciesCount ?? 0}
          </p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Species</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <p className="text-2xl font-display font-bold text-purple-400">
            {user?.level ?? 1}
          </p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Level</p>
        </GlassCard>
      </div>

      {/* Category Breakdown */}
      <GlassCard className="p-4">
        <h3 className="font-semibold text-white mb-3">Collection Breakdown</h3>
        <div className="space-y-2">
          {Object.entries(categoryStats)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, count]) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-20 truncate">{cat}</span>
                <div className="flex-1">
                  <ProgressBar
                    value={count as number}
                    max={Math.max(...Object.values(categoryStats) as number[])}
                    color="brand"
                  />
                </div>
                <span className="text-xs font-mono text-gray-300 w-8 text-right">{count as number}</span>
              </div>
            ))}
          {Object.keys(categoryStats).length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No discoveries yet</p>
          )}
        </div>
      </GlassCard>

      {/* Actions */}
      <div className="space-y-2">
        <Button variant="secondary" size="lg" className="w-full justify-start" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
