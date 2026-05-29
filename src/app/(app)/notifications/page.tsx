'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';
import { GlassCard, Button, EmptyState, Skeleton, Badge } from '@/components/ui';
import { formatDate, cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const setStoreNotifications = useAppStore((s) => s.setNotifications);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data.notifications);
        setStoreNotifications(data.data.notifications, data.data.unreadCount);
      }
    } catch (err) {
      console.error('Notifications load error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id?: string) {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(id ? { notificationIds: [id] } : { markAll: true }),
    });
    load();
  }

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const iconMap: Record<string, string> = {
    DISCOVERY: '🔬',
    ACHIEVEMENT: '🏆',
    FRIEND_REQUEST: '👥',
    FRIEND_ACCEPTED: '🤝',
    CLAN_INVITE: '🛡️',
    QUEST_COMPLETE: '📜',
    MODERATION: '⚠️',
    SYSTEM: '📢',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-6 w-6 text-brand-400" />
          <h1 className="text-2xl font-display font-bold text-white">Notifications</h1>
          {unreadCount > 0 && (
            <Badge variant="danger">{unreadCount}</Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => markRead()}>
            <CheckCheck className="h-4 w-4" />
            Mark all
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : notifications.length > 0 ? (
        <GlassCard className="divide-y divide-white/5">
          {notifications.map((notif, i) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className={cn(
                'flex items-start gap-3 p-3 transition-colors',
                !notif.readAt && 'bg-brand-900/10'
              )}
              onClick={() => !notif.readAt && markRead(notif.id)}
            >
              <span className="text-xl">{iconMap[notif.type] ?? '📌'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">{notif.title}</p>
                {notif.body && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{notif.body}</p>
                )}
                <p className="text-[10px] text-gray-600 mt-1">{formatDate(notif.createdAt)}</p>
              </div>
              {!notif.readAt && (
                <span className="w-2 h-2 rounded-full bg-brand-400 mt-2 shrink-0" />
              )}
            </motion.div>
          ))}
        </GlassCard>
      ) : (
        <EmptyState
          icon={<Bell className="h-12 w-12" />}
          title="All caught up!"
          description="You have no notifications right now."
        />
      )}
    </div>
  );
}
