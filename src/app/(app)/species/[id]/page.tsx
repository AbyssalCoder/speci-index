'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Calendar, Globe, ChevronRight } from 'lucide-react';
import { GlassCard, Button, Badge, Skeleton } from '@/components/ui';
import { RarityBadge } from '@/components/species/species-card';
import { getConservationLabel, getConservationColor, formatNumber, getRarityColor, getRarityLabel } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { use } from 'react';

export default function SpeciesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [species, setSpecies] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/species?id=${id}`);
        const data = await res.json();
        if (data.success) setSpecies(data.data);
      } catch (err) {
        console.error('Species load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!species) {
    return (
      <GlassCard className="p-8 text-center">
        <p className="text-gray-400">Species not found.</p>
        <Button variant="ghost" className="mt-3" onClick={() => router.back()}>
          Go Back
        </Button>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Image */}
      {species.imageUrl && (
        <div className="relative rounded-2xl overflow-hidden border border-white/10 aspect-video">
          <img src={species.imageUrl} alt={species.commonName} className="w-full h-full object-cover" />
          <div className="absolute bottom-3 left-3">
            <RarityBadge tier={species.rarityTier} />
          </div>
        </div>
      )}

      {/* Info */}
      <div>
        <h1 className="text-2xl font-display font-bold text-white">{species.commonName}</h1>
        <p className="text-sm text-gray-400 italic">{species.scientificName}</p>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        <Badge>{species.category}</Badge>
        <Badge variant={species.verified ? 'success' : 'warning'}>
          {species.verified ? 'Verified' : 'Unverified'}
        </Badge>
        {species.conservationStatus && (
          <Badge>
            {getConservationLabel(species.conservationStatus)}
          </Badge>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <GlassCard className="p-3 text-center">
          <p className="text-xl font-bold text-brand-400">{formatNumber(species.points ?? 0)}</p>
          <p className="text-[10px] text-gray-500">Points</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <p className="text-xl font-bold text-green-400">{species.totalObservations ?? 0}</p>
          <p className="text-[10px] text-gray-500">Observations</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <p className="text-xl font-bold text-purple-400">{getRarityLabel(species.rarityTier)}</p>
          <p className="text-[10px] text-gray-500">Rarity</p>
        </GlassCard>
      </div>

      {/* Description */}
      {species.description && (
        <GlassCard className="p-4">
          <h3 className="text-sm font-semibold text-white mb-2">About</h3>
          <p className="text-sm text-gray-400 leading-relaxed">{species.description}</p>
        </GlassCard>
      )}

      {/* Taxonomy */}
      <GlassCard className="p-4">
        <h3 className="text-sm font-semibold text-white mb-2">Taxonomy</h3>
        <div className="space-y-1.5">
          {[
            { label: 'Kingdom', value: species.kingdom },
            { label: 'Phylum', value: species.phylum },
            { label: 'Class', value: species.class },
            { label: 'Order', value: species.order },
            { label: 'Family', value: species.family },
            { label: 'Genus', value: species.genus },
          ]
            .filter((t) => t.value)
            .map((t) => (
              <div key={t.label} className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{t.label}</span>
                <span className="text-xs font-medium text-gray-300">{t.value}</span>
              </div>
            ))}
        </div>
      </GlassCard>
    </div>
  );
}
