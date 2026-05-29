import { create } from 'zustand';
import type { UserProfile, DiscoveryEntry, NotificationItem } from '@/types';

interface AppState {
  // User
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;

  // Collection
  collection: DiscoveryEntry[];
  setCollection: (items: DiscoveryEntry[]) => void;
  addDiscovery: (entry: DiscoveryEntry) => void;

  // Notifications
  notifications: NotificationItem[];
  unreadCount: number;
  setNotifications: (items: NotificationItem[], unread: number) => void;
  markRead: (ids: string[]) => void;

  // UI State
  isCaptureOpen: boolean;
  setCaptureOpen: (open: boolean) => void;
  isSubmitting: boolean;
  setSubmitting: (v: boolean) => void;

  // Offline Queue
  offlineQueue: Array<{ imageBase64: string; latitude?: number; longitude?: number; timestamp: number }>;
  addToQueue: (item: { imageBase64: string; latitude?: number; longitude?: number }) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  setUser: (user) => set({ user }),

  collection: [],
  setCollection: (items) => set({ collection: items }),
  addDiscovery: (entry) =>
    set((state) => ({ collection: [entry, ...state.collection] })),

  notifications: [],
  unreadCount: 0,
  setNotifications: (items, unread) =>
    set({ notifications: items, unreadCount: unread }),
  markRead: (ids) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        ids.includes(n.id) ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - ids.length),
    })),

  isCaptureOpen: false,
  setCaptureOpen: (open) => set({ isCaptureOpen: open }),
  isSubmitting: false,
  setSubmitting: (v) => set({ isSubmitting: v }),

  offlineQueue: [],
  addToQueue: (item) =>
    set((state) => ({
      offlineQueue: [...state.offlineQueue, { ...item, timestamp: Date.now() }],
    })),
  removeFromQueue: (index) =>
    set((state) => ({
      offlineQueue: state.offlineQueue.filter((_, i) => i !== index),
    })),
  clearQueue: () => set({ offlineQueue: [] }),
}));
