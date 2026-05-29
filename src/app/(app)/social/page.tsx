'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, UserPlus, Search, Check, X, Shield, Plus, Mail } from 'lucide-react';
import { GlassCard, Button, Avatar, Input, EmptyState, Skeleton, Badge } from '@/components/ui';
import { formatNumber } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function SocialPage() {
  const [tab, setTab] = useState<'friends' | 'requests' | 'clans'>('friends');
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [clans, setClans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add friend state
  const [friendInput, setFriendInput] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);

  // Create clan state
  const [showCreateClan, setShowCreateClan] = useState(false);
  const [clanName, setClanName] = useState('');
  const [clanTag, setClanTag] = useState('');
  const [clanDescription, setClanDescription] = useState('');
  const [creatingClan, setCreatingClan] = useState(false);

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

  async function sendFriendRequest() {
    if (!friendInput.trim()) return;
    setSendingRequest(true);
    try {
      const isEmail = friendInput.includes('@');
      const body = isEmail
        ? { email: friendInput.trim() }
        : { username: friendInput.trim() };

      const res = await fetch('/api/social/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        toast.success('Friend request sent!');
        setFriendInput('');
      } else {
        toast.error(data.error || 'Failed to send request');
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSendingRequest(false);
    }
  }

  async function handleCreateClan() {
    if (!clanName.trim() || !clanTag.trim()) {
      toast.error('Name and tag are required');
      return;
    }
    setCreatingClan(true);
    try {
      const res = await fetch('/api/social/clans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: clanName.trim(),
          tag: clanTag.trim().toUpperCase(),
          description: clanDescription.trim() || undefined,
          isPublic: true,
        }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success('Clan created!');
        setClanName('');
        setClanTag('');
        setClanDescription('');
        setShowCreateClan(false);
        loadData();
      } else {
        toast.error(data.error || 'Failed to create clan');
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setCreatingClan(false);
    }
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

      {/* Search & Add Friend */}
      {tab === 'friends' && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search friends..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Add friend by email or username..."
                value={friendInput}
                onChange={(e) => setFriendInput(e.target.value)}
                className="pl-10"
                onKeyDown={(e) => e.key === 'Enter' && sendFriendRequest()}
              />
            </div>
            <Button
              variant="default"
              size="lg"
              onClick={sendFriendRequest}
              isLoading={sendingRequest}
              disabled={!friendInput.trim()}
            >
              <UserPlus className="h-4 w-4" />
              Add
            </Button>
          </div>
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
        <>
          <div className="flex justify-end">
            <Button variant="default" size="sm" onClick={() => setShowCreateClan(!showCreateClan)}>
              <Plus className="h-4 w-4" />
              Create Clan
            </Button>
          </div>

          {showCreateClan && (
            <GlassCard className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white">Create a Clan</h3>
              <Input
                placeholder="Clan name (3-30 chars)"
                value={clanName}
                onChange={(e) => setClanName(e.target.value)}
                maxLength={30}
              />
              <Input
                placeholder="Tag (2-6 chars, e.g. APEX)"
                value={clanTag}
                onChange={(e) => setClanTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                maxLength={6}
              />
              <Input
                placeholder="Description (optional)"
                value={clanDescription}
                onChange={(e) => setClanDescription(e.target.value)}
                maxLength={280}
              />
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => setShowCreateClan(false)}>
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1"
                  onClick={handleCreateClan}
                  isLoading={creatingClan}
                  disabled={!clanName.trim() || !clanTag.trim()}
                >
                  Create
                </Button>
              </div>
            </GlassCard>
          )}

          {clans.length > 0 ? (
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
        ) : !showCreateClan ? (
          <EmptyState
            icon={<Shield className="h-12 w-12" />}
            title="No clans found"
            description="Create a clan to compete as a team!"
            action={<Button onClick={() => setShowCreateClan(true)}>Create Clan</Button>}
          />
        ) : null}
        </>
      )}
    </div>
  );
}
