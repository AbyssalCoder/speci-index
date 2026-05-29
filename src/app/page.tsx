'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Camera, Search, Map as MapIcon, Trophy, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui';

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-surface-0 flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10"
        >
          {/* Logo */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
            className="w-20 h-20 rounded-2xl bg-brand-600 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-brand-600/30"
          >
            <Sparkles className="h-10 w-10 text-white" />
          </motion.div>

          <h1 className="text-5xl font-display font-bold text-white mb-3">
            Speci-Index
          </h1>
          <p className="text-xl text-gray-400 mb-2">
            Discover. Photograph. Collect.
          </p>
          <p className="text-sm text-gray-500 max-w-md mx-auto mb-10">
            The real-world species collection game. Use AI to identify wildlife,
            build your collection, and compete with explorers worldwide.
          </p>

          <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
            <Link href="/login">
              <Button size="xl" className="w-full">
                Get Started
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary" size="xl" className="w-full">
                Sign In
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Feature cards */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="grid grid-cols-2 gap-3 mt-16 w-full max-w-sm relative z-10"
        >
          {[
            { icon: Camera, label: 'AI Identification', desc: 'Point & shoot' },
            { icon: Search, label: 'Species Index', desc: 'Collect them all' },
            { icon: MapIcon, label: 'Explore Map', desc: 'Find species' },
            { icon: Trophy, label: 'Leaderboards', desc: 'Compete globally' },
          ].map((feature, i) => (
            <motion.div
              key={feature.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + i * 0.1 }}
              className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-4"
            >
              <feature.icon className="h-6 w-6 text-brand-400 mb-2" />
              <p className="text-sm font-semibold text-white">{feature.label}</p>
              <p className="text-xs text-gray-500">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-gray-600 border-t border-white/5">
        <p>Powered by BioCLIP · Free & Open Source</p>
      </footer>
    </div>
  );
}
