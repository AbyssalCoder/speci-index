'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, UserPlus, Search, Check, X, Shield } from 'lucide-react';
import { GlassCard, Button, Avatar, Input, EmptyState, Skeleton, Badge } from '@/components/ui';
import { formatNumber } from '@/lib/utils';

export default function SocialPage() {
  const [tab, setTab] = useState<'friends' | 'requests' | 'clans'>('friends');
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [clans, setClans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, [tab]);

  async function loadData() {
    setLoading(true);
    try {
      if (tab === 'friends') {
        const res = await fetch('/api/social/friends?type=friends');
        const data = await res.json();
        if (data.success) setFriends(data.data);
      } else if (tab === 'requests') {
        const res = await fetch('/api/social/friends?type=requests');
        const data = await res.json();
        if (data.success) setRequests(data.data);
      } else {
        const res = await fetch('/api/social/clans');
        const data = await res.json();
        if (data.success) setClans(data.data.items);
      }
    } catch (err) {
      console.error('Social load error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestAction(requestId: string, action: 'accept' | 'reject') {
    await fetch('/api/social/friends', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, action }),
    });
    loadData();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-display font-bold text-white">Social</h1>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { value: 'friends' as const, label: 'Friends', icon: Users },
          { value: 'requests' as const, label: 'Requests', icon: UserPlus },
          { value: 'clans' as const, label: 'Clans', icon: Shield },
        ].map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              tab === t.value
                ? 'bg-brand-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {t.value === 'requests' && requests.length > 0 && (
              <span className="ml-1 w-4 h-4 rounded-full bg-red-500 text-[10px] flex items-center justify-center">
                {requests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      {tab === 'friends' && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search friends..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : tab === 'friends' ? (
        friends.length > 0 ? (
          <GlassCard className="divide-y divide-white/5">
            {friends
              .filter((f: any) =>
                search ? f.displayName?.toLowerCase().includes(search.toLowerCase()) : true
              )
              .map((friend: any) => (
                <div key={friend.id} className="flex items-center gap-3 p-3">
                  <Avatar src={friend.avatarUrl} alt={friend.displayName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{friend.displayName}</p>
                    <p className="text-xs text-gray-500">{friend.speciesCount} species</p>
                  </div>
                  <span className="text-sm font-bold text-brand-400">{formatNumber(friend.totalPoints)}</span>
                </div>
              ))}
          </GlassCard>
        ) : (
          <EmptyState
            icon={<Users className="h-12 w-12" />}
            title="No friends yet"
            description="Add friends to compare collections and compete!"
          />
        )
      ) : tab === 'requests' ? (
        requests.length > 0 ? (
          <GlassCard className="divide-y divide-white/5">
            {requests.map((req: any) => (
              <div key={req.id} className="flex items-center gap-3 p-3">
                <Avatar src={req.sender.avatarUrl} alt={req.sender.displayName} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{req.sender.displayName}</p>
                  <p className="text-xs text-gray-500">@{req.sender.username}</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="success"
                    size="icon-sm"
                    onClick={() => handleRequestAction(req.id, 'accept')}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleRequestAction(req.id, 'reject')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </GlassCard>
        ) : (
          <EmptyState
            icon={<UserPlus className="h-12 w-12" />}
            title="No pending requests"
            description="Share your profile to get friend requests!"
          />
        )
      ) : (
        /* Clans */
        clans.length > 0 ? (
          <div className="space-y-3">
            {clans.map((clan: any) => (
              <GlassCard key={clan.id} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-brand-600/20 flex items-center justify-center">
                    <span className="text-sm font-bold text-brand-400">[{clan.tag}]</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white">{clan.name}</p>
                    <p className="text-xs text-gray-500">
                      {clan.memberCount}/{clan.maxMembers} members
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-brand-400">{formatNumber(clan.totalPoints)}</p>
                    <p className="text-[10px] text-gray-500">points</p>
                  </div>
                </div>
                {clan.description && (
                  <p className="text-xs text-gray-400 mt-2">{clan.description}</p>
                )}
              </GlassCard>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Shield className="h-12 w-12" />}
            title="No clans found"
            description="Create a clan to compete as a team!"
            action={<Button>Create Clan</Button>}
          />
        )
      )}
    </div>
  );
}
