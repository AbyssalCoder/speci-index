import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { RarityTier, ConservationStatus } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getRarityColor(tier: RarityTier): string {
  const colors: Record<RarityTier, string> = {
    COMMON: '#9ca3af',
    UNCOMMON: '#22c55e',
    RARE: '#3b82f6',
    EPIC: '#a855f7',
    LEGENDARY: '#f59e0b',
    MYTHIC: '#ef4444',
  };
  return colors[tier];
}

export function getRarityGradient(tier: RarityTier): string {
  const gradients: Record<RarityTier, string> = {
    COMMON: 'from-gray-500 to-gray-400',
    UNCOMMON: 'from-green-600 to-green-400',
    RARE: 'from-blue-600 to-blue-400',
    EPIC: 'from-purple-600 to-purple-400',
    LEGENDARY: 'from-amber-600 to-amber-400',
    MYTHIC: 'from-red-600 to-red-400',
  };
  return gradients[tier];
}

export function getRarityLabel(tier: RarityTier): string {
  return tier.charAt(0) + tier.slice(1).toLowerCase();
}

export function getConservationLabel(status: ConservationStatus): string {
  const labels: Record<ConservationStatus, string> = {
    EX: 'Extinct',
    EW: 'Extinct in Wild',
    CR: 'Critically Endangered',
    EN: 'Endangered',
    VU: 'Vulnerable',
    NT: 'Near Threatened',
    LC: 'Least Concern',
    DD: 'Data Deficient',
    NE: 'Not Evaluated',
  };
  return labels[status];
}

export function getConservationColor(status: ConservationStatus): string {
  const colors: Record<ConservationStatus, string> = {
    EX: '#1f2937',
    EW: '#4b5563',
    CR: '#dc2626',
    EN: '#ea580c',
    VU: '#f59e0b',
    NT: '#84cc16',
    LC: '#22c55e',
    DD: '#6b7280',
    NE: '#9ca3af',
  };
  return colors[status];
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

export function calculateLevel(xp: number): { level: number; progress: number; xpForNext: number } {
  // XP curve: each level requires level * 100 XP
  let level = 1;
  let totalXpNeeded = 0;
  while (totalXpNeeded + level * 100 <= xp) {
    totalXpNeeded += level * 100;
    level++;
  }
  const xpForNext = level * 100;
  const currentLevelXp = xp - totalXpNeeded;
  return {
    level,
    progress: currentLevelXp / xpForNext,
    xpForNext,
  };
}

export function getDistanceKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function isInsideRadius(
  lat: number, lon: number,
  centerLat: number, centerLon: number,
  radiusMeters: number
): boolean {
  return getDistanceKm(lat, lon, centerLat, centerLon) * 1000 <= radiusMeters;
}

export function generateDeviceId(): string {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const screen = typeof window !== 'undefined' ? window.screen : null;
  const base = [
    nav?.userAgent ?? '',
    nav?.language ?? '',
    screen?.width ?? '',
    screen?.height ?? '',
    screen?.colorDepth ?? '',
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join('|');
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    const char = base.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}
