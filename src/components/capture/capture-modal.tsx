'use client';

import React, { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, X, RotateCcw, Zap, MapPin, Loader2 } from 'lucide-react';
import { Button, GlassCard } from '@/components/ui';
import { useCamera, useGeolocation, useSubmission } from '@/hooks/use-capture';
import { cn } from '@/lib/utils';

interface CaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: Record<string, unknown>) => void;
}

export function CaptureModal({ isOpen, onClose, onSuccess }: CaptureModalProps) {
  const { videoRef, canvasRef, isActive, start, stop, capture, toggleFacing, facing } = useCamera();
  const { position, getCurrentPosition, loading: gpsLoading } = useGeolocation();
  const { submit, isSubmitting } = useSubmission();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [mode, setMode] = useState<'select' | 'camera' | 'preview'>('select');

  const handleCapture = useCallback(() => {
    const base64 = capture();
    if (base64) {
      setCapturedImage(base64);
      stop();
      setMode('preview');
    }
  }, [capture, stop]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) return;
    if (file.size > 20 * 1024 * 1024) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setCapturedImage(base64);
      setMode('preview');
    };
    reader.readAsDataURL(file);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!capturedImage) return;

    // Get GPS if not already available
    let coords = position;
    if (!coords) {
      try {
        coords = await getCurrentPosition();
      } catch {
        // Continue without GPS
      }
    }

    const result = await submit(capturedImage, coords?.latitude, coords?.longitude);
    if (result?.success || result?.queued) {
      onSuccess(result);
      handleReset();
      onClose();
    }
  }, [capturedImage, position, getCurrentPosition, submit, onSuccess, onClose]);

  const handleReset = useCallback(() => {
    setCapturedImage(null);
    setMode('select');
    stop();
  }, [stop]);

  const startCamera = useCallback(async () => {
    setMode('camera');
    try {
      await start();
    } catch {
      setMode('select');
    }
  }, [start]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-surface-0"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <Button variant="ghost" size="icon-sm" onClick={() => { handleReset(); onClose(); }}>
              <X className="h-5 w-5" />
            </Button>
            <h2 className="font-display font-bold text-white">Capture Species</h2>
            <div className="w-8" />
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col">
            {mode === 'select' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 flex flex-col items-center justify-center gap-6 p-8"
              >
                <div className="text-center mb-4">
                  <div className="w-20 h-20 rounded-full bg-brand-600/20 flex items-center justify-center mx-auto mb-4">
                    <Zap className="h-10 w-10 text-brand-400" />
                  </div>
                  <h3 className="text-xl font-display font-bold text-white mb-2">
                    Discover a Species
                  </h3>
                  <p className="text-gray-400 text-sm max-w-xs">
                    Take a photo or upload one to identify and collect a new species
                  </p>
                </div>

                <div className="w-full max-w-xs space-y-3">
                  <Button
                    variant="default"
                    size="xl"
                    className="w-full"
                    onClick={startCamera}
                  >
                    <Camera className="h-5 w-5" />
                    Open Camera
                  </Button>

                  <Button
                    variant="secondary"
                    size="xl"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-5 w-5" />
                    Upload Photo
                  </Button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />

                {/* GPS Status */}
                <button
                  onClick={() => getCurrentPosition()}
                  className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <MapPin className="h-3 w-3" />
                  {gpsLoading ? 'Getting location...' : position ? 'Location acquired' : 'Tap to enable GPS'}
                </button>
              </motion.div>
            )}

            {mode === 'camera' && (
              <div className="flex-1 flex flex-col relative">
                <div className="flex-1 bg-black relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Camera overlay */}
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Viewfinder corners */}
                    <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-brand-400 rounded-tl-lg" />
                    <div className="absolute top-8 right-8 w-12 h-12 border-t-2 border-r-2 border-brand-400 rounded-tr-lg" />
                    <div className="absolute bottom-24 left-8 w-12 h-12 border-b-2 border-l-2 border-brand-400 rounded-bl-lg" />
                    <div className="absolute bottom-24 right-8 w-12 h-12 border-b-2 border-r-2 border-brand-400 rounded-br-lg" />
                  </div>
                </div>

                {/* Camera controls */}
                <div className="absolute bottom-0 inset-x-0 pb-8 pt-4 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="flex items-center justify-center gap-8">
                    <Button variant="ghost" size="icon-lg" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-6 w-6" />
                    </Button>

                    <button
                      onClick={handleCapture}
                      className="w-16 h-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/30 active:scale-90 transition-all"
                    />

                    <Button variant="ghost" size="icon-lg" onClick={toggleFacing}>
                      <RotateCcw className="h-6 w-6" />
                    </Button>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            )}

            {mode === 'preview' && capturedImage && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex flex-col"
              >
                <div className="flex-1 relative bg-black">
                  <img
                    src={`data:image/jpeg;base64,${capturedImage}`}
                    alt="Captured"
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="p-4 space-y-3 border-t border-white/10">
                  {position && (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <MapPin className="h-3 w-3" />
                      {position.latitude.toFixed(4)}, {position.longitude.toFixed(4)}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button variant="secondary" size="lg" className="flex-1" onClick={handleReset}>
                      Retake
                    </Button>
                    <Button
                      variant="default"
                      size="lg"
                      className="flex-1"
                      onClick={handleSubmit}
                      isLoading={isSubmitting}
                    >
                      {isSubmitting ? 'Identifying...' : 'Identify Species'}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
