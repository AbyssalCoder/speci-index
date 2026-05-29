'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { BottomNav, TopBar } from '@/components/layout/navigation';
import { useAppStore } from '@/stores/app-store';
import { Toaster } from 'react-hot-toast';

const CaptureModal = dynamic(
  () => import('@/components/capture/capture-modal').then((m) => m.CaptureModal),
  { ssr: false }
);

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const isCaptureOpen = useAppStore((s) => s.isCaptureOpen);
  const setCaptureOpen = useAppStore((s) => s.setCaptureOpen);

  return (
    <div className="min-h-dvh bg-surface-0 pb-20">
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#1a1a25',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
          },
        }}
      />
      <TopBar />
      <main className="max-w-lg mx-auto px-4 py-4">
        {children}
      </main>
      <BottomNav />

      <CaptureModal
        isOpen={isCaptureOpen}
        onClose={() => setCaptureOpen(false)}
        onSuccess={(result) => {
          console.log('Submission result:', result);
        }}
      />
    </div>
  );
}
