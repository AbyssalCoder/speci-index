'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, Grid3x3, List, SlidersHorizontal } from 'lucide-react';
import { Input, GlassCard, Skeleton, EmptyState, Button } from '@/components/ui';
import { SpeciesCard } from '@/components/species/species-card';
import { useAppStore } from '@/stores/app-store';
import type { SpeciesCategory } from '@/types';

const CATEGORIES: { label: string; value: SpeciesCategory | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Mammals', value: 'MAMMAL' },
  { label: 'Birds', value: 'BIRD' },
  { label: 'Reptiles', value: 'REPTILE' },
  { label: 'Amphibians', value: 'AMPHIBIAN' },
  { label: 'Fish', value: 'FISH' },
  { label: 'Insects', value: 'INSECT' },
  { label: 'Marine', value: 'MARINE' },
  { label: 'Flowers', value: 'FLOWER' },
  { label: 'Fungi', value: 'FUNGI' },
];

export default function CollectionPage() {
  const collection = useAppStore((s) => s.collection);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<SpeciesCategory | 'ALL'>('ALL');
  const [sort, setSort] = useState<'date' | 'rarity' | 'name'>('date');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const params = new URLSearchParams();
        if (category !== 'ALL') params.set('category', category);
        if (search) params.set('search', search);
        params.set('sort', sort);

        const res = await fetch(`/api/collection?${params}`);
        const data = await res.json();
        if (data.success) {
          useAppStore.getState().setCollection(data.data);
        }
      } catch (err) {
        console.error('Collection load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [category, sort, search]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-white">Speci-Index</h1>
        <p className="text-sm text-gray-400">{collection.length} species discovered</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <Input
          placeholder="Search species..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              category === cat.value
                ? 'bg-brand-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-gray-500" />
        <div className="flex gap-1">
          {(['date', 'rarity', 'name'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                sort === s ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {s === 'date' ? 'Recent' : s === 'rarity' ? 'Rarity' : 'Name'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="aspect-[3/4]" />
          ))}
        </div>
      ) : collection.length > 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-2 gap-3"
        >
          {collection.map((d: any, i: number) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <SpeciesCard
                imageUrl={d.imageUrl}
                commonName={d.species.commonName}
                scientificName={d.species.scientificName}
                rarityTier={d.species.rarityTier}
                rarityPoints={d.species.rarityPoints}
                conservationStatus={d.species.conservationStatus}
                category={d.species.category}
              />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <EmptyState
          icon={<Grid3x3 className="h-12 w-12" />}
          title="No species found"
          description="Start exploring to build your collection!"
          action={
            <Button onClick={() => useAppStore.getState().setCaptureOpen(true)}>
              Capture First Species
            </Button>
          }
        />
      )}
    </div>
  );
}
