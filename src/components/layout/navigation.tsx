'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Home,
  Search,
  Camera,
  Map,
  User,
  Trophy,
  Users,
  Award,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/collection', label: 'Index', icon: Search },
  { href: '/capture', label: 'Capture', icon: Camera, isCenter: true },
  { href: '/map', label: 'Map', icon: Map },
  { href: '/profile', label: 'Profile', icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const setCaptureOpen = useAppStore((s) => s.setCaptureOpen);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 safe-area-bottom">
      <div className="mx-auto max-w-lg">
        <div className="flex items-center justify-around bg-surface-1/90 backdrop-blur-xl border-t border-white/10 px-2 py-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            if (item.isCenter) {
              return (
                <button
                  key={item.href}
                  onClick={() => setCaptureOpen(true)}
                  className="relative -mt-6"
                >
                  <div className="w-14 h-14 rounded-full bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-600/30 hover:bg-brand-500 active:scale-95 transition-all">
                    <Camera className="h-6 w-6 text-white" />
                  </div>
                </button>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-colors',
                  isActive ? 'text-brand-400' : 'text-gray-500 hover:text-gray-300'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute bottom-0 w-8 h-0.5 rounded-full bg-brand-400"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export function TopBar() {
  const user = useAppStore((s) => s.user);
  const unreadCount = useAppStore((s) => s.unreadCount);

  return (
    <header className="sticky top-0 z-30 bg-surface-0/80 backdrop-blur-xl border-b border-white/5">
      <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">SI</span>
          </div>
          <span className="font-display font-bold text-white text-lg">Speci-Index</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link href="/leaderboard" className="text-gray-400 hover:text-white transition-colors">
            <Trophy className="h-5 w-5" />
          </Link>
          <Link href="/social" className="text-gray-400 hover:text-white transition-colors">
            <Users className="h-5 w-5" />
          </Link>
          <Link href="/achievements" className="text-gray-400 hover:text-white transition-colors">
            <Award className="h-5 w-5" />
          </Link>
          <Link href="/notifications" className="relative text-gray-400 hover:text-white transition-colors">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
