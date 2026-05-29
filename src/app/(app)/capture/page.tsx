'use client';

import React from 'react';
import { useAppStore } from '@/stores/app-store';

export default function CapturePage() {
  const setCaptureOpen = useAppStore((s) => s.setCaptureOpen);

  React.useEffect(() => {
    setCaptureOpen(true);
  }, [setCaptureOpen]);

  return (
    <div className="flex items-center justify-center py-20">
      <p className="text-gray-500">Opening camera...</p>
    </div>
  );
}
