'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn, getRarityGradient, getRarityLabel, getConservationLabel, getConservationColor, formatNumber } from '@/lib/utils';
import type { RarityTier, ConservationStatus } from '@/types';

interface SpeciesCardProps {
  imageUrl: string;
  commonName: string;
  scientificName: string;
  rarityTier: RarityTier;
  rarityPoints: number;
  conservationStatus: ConservationStatus;
  category: string;
  isDiscovered?: boolean;
  onClick?: () => void;
  className?: string;
}

export function SpeciesCard({
  imageUrl,
  commonName,
  scientificName,
  rarityTier,
  rarityPoints,
  conservationStatus,
  category,
  isDiscovered = true,
  onClick,
  className,
}: SpeciesCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'relative rounded-2xl overflow-hidden cursor-pointer group',
        'border border-white/10 bg-surface-1',
        'transition-shadow duration-300',
        isDiscovered ? 'hover:shadow-lg hover:shadow-brand-500/10' : 'opacity-50 grayscale',
        className
      )}
      onClick={onClick}
    >
      {/* Rarity glow effect */}
      <div
        className={cn(
          'absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300 rounded-2xl',
          `bg-gradient-to-br ${getRarityGradient(rarityTier)}`
        )}
      />

      {/* Image */}
      <div className="relative aspect-square overflow-hidden">
        <img
          src={imageUrl || '/placeholder-species.svg'}
          alt={commonName}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Rarity badge */}
        <div className="absolute top-2 right-2">
          <RarityBadge tier={rarityTier} points={rarityPoints} />
        </div>

        {/* Category badge */}
        <div className="absolute top-2 left-2">
          <span className="px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-[10px] font-medium text-white/80 uppercase tracking-wider">
            {category}
          </span>
        </div>

        {/* Undiscovered overlay */}
        {!isDiscovered && (
          <div className="absolute inset-0 bg-surface-0/80 flex items-center justify-center">
            <span className="text-4xl">❓</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-semibold text-white text-sm truncate">{commonName}</h3>
        <p className="text-xs text-gray-500 italic truncate">{scientificName}</p>

        <div className="flex items-center justify-between mt-2">
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: getConservationColor(conservationStatus) + '20',
              color: getConservationColor(conservationStatus),
            }}
          >
            {getConservationLabel(conservationStatus)}
          </span>
          <span className="text-xs text-gray-400">{formatNumber(rarityPoints)} pts</span>
        </div>
      </div>
    </motion.div>
  );
}

export function RarityBadge({ tier, points, size = 'sm' }: { tier: RarityTier; points?: number; size?: 'sm' | 'md' }) {
  const sizeClasses = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-3 py-1';

  return (
    <span
      className={cn(
        'font-bold rounded-full backdrop-blur-sm border',
        `bg-gradient-to-r ${getRarityGradient(tier)}`,
        'text-white border-white/20 shadow-lg',
        sizeClasses,
        tier === 'MYTHIC' && 'animate-glow-pulse',
        tier === 'LEGENDARY' && 'animate-shimmer bg-[length:200%_100%]',
      )}
    >
      {getRarityLabel(tier)}
      {points != null && ` · ${formatNumber(points)}`}
    </span>
  );
}

export function DiscoveryReveal({
  species,
  onClose,
}: {
  species: {
    commonName: string;
    scientificName: string;
    rarityTier: RarityTier;
    rarityPoints: number;
    conservationStatus: ConservationStatus;
    category: string;
    imageUrl?: string;
  };
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.5, rotateY: 180 }}
        animate={{ scale: 1, rotateY: 0 }}
        transition={{ type: 'spring', damping: 15, stiffness: 100, duration: 0.8 }}
        className="relative max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow background */}
        <div
          className={cn(
            'absolute inset-0 rounded-3xl blur-3xl opacity-30',
            `bg-gradient-to-br ${getRarityGradient(species.rarityTier)}`
          )}
        />

        <div className="relative rounded-3xl border border-white/20 bg-surface-1/90 backdrop-blur-xl overflow-hidden">
          {/* Header */}
          <div className="text-center py-4">
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-brand-400 font-display text-sm font-bold uppercase tracking-widest"
            >
              ★ New Discovery ★
            </motion.p>
          </div>

          {/* Species Image */}
          <div className="px-6">
            <div className="aspect-square rounded-2xl overflow-hidden border-2 border-white/10">
              <img
                src={species.imageUrl || '/placeholder-species.svg'}
                alt={species.commonName}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Species Info */}
          <div className="p-6 text-center space-y-3">
            <motion.h2
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-2xl font-display font-bold text-white"
            >
              {species.commonName}
            </motion.h2>
            <p className="text-gray-400 italic text-sm">{species.scientificName}</p>

            <div className="flex justify-center">
              <RarityBadge tier={species.rarityTier} points={species.rarityPoints} size="md" />
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <span
                className="text-xs font-medium px-2 py-1 rounded-full"
                style={{
                  backgroundColor: getConservationColor(species.conservationStatus) + '20',
                  color: getConservationColor(species.conservationStatus),
                }}
              >
                {getConservationLabel(species.conservationStatus)}
              </span>
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-white/5 text-gray-300">
                {species.category}
              </span>
            </div>

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.7, type: 'spring' }}
              className="pt-4"
            >
              <p className="text-3xl font-display font-bold text-brand-400">
                +{formatNumber(species.rarityPoints)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Points Earned</p>
            </motion.div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-full py-4 text-center text-brand-400 font-semibold border-t border-white/10 hover:bg-white/5 transition-colors"
          >
            Awesome!
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
