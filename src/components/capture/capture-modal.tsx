'use client';

import React, { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, X, RotateCcw, Zap, MapPin, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button, GlassCard } from '@/components/ui';
import { useCamera, useGeolocation, useSubmission } from '@/hooks/use-capture';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

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
  const [mode, setMode] = useState<'select' | 'camera' | 'preview' | 'result'>('select');
  const [submissionResult, setSubmissionResult] = useState<Record<string, unknown> | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

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

    setSubmissionError(null);

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

    if (result?.queued) {
      toast.success('Photo queued — will identify when back online');
      handleReset();
      onClose();
      return;
    }

    if (result?.success && result?.data) {
      const data = result.data as Record<string, unknown>;
      setSubmissionResult(data);
      setMode('result');
      onSuccess(result);

      const species = data.species as { commonName?: string; scientificName?: string; rarityTier?: string } | undefined;
      const speciesName = species?.commonName || species?.scientificName || 'Unknown';
      const isFirst = data.isFirstDiscovery;
      const points = data.pointsAwarded as number;

      if (isFirst) {
        toast.success(`New discovery: ${speciesName}! +${points} pts`, { duration: 4000 });
      } else {
        toast(`${speciesName} — already in your collection`, { icon: '📋', duration: 3000 });
      }
    } else {
      const errorMsg = result?.error || 'Identification failed. Try again.';
      setSubmissionError(errorMsg);
      toast.error(errorMsg, { duration: 4000 });
    }
  }, [capturedImage, position, getCurrentPosition, submit, onSuccess, onClose]);

  const handleReset = useCallback(() => {
    setCapturedImage(null);
    setMode('select');
    setSubmissionResult(null);
    setSubmissionError(null);
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

                  {submissionError && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                      <p className="text-sm text-red-300">{submissionError}</p>
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
                      {isSubmitting ? 'Identifying...' : submissionError ? 'Try Again' : 'Identify Species'}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {mode === 'result' && submissionResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex-1 flex flex-col items-center justify-center p-8"
              >
                {(() => {
                  const species = submissionResult.species as { commonName?: string; scientificName?: string; rarityTier?: string; category?: string } | undefined;
                  const isFirst = submissionResult.isFirstDiscovery as boolean;
                  const points = submissionResult.pointsAwarded as number;
                  const confidence = submissionResult.aiConfidence as number;

                  return (
                    <div className="text-center space-y-4 w-full max-w-xs">
                      <div className={cn(
                        "w-20 h-20 rounded-full flex items-center justify-center mx-auto",
                        isFirst ? "bg-brand-600/20" : "bg-gray-600/20"
                      )}>
                        <CheckCircle className={cn("h-10 w-10", isFirst ? "text-brand-400" : "text-gray-400")} />
                      </div>

                      <div>
                        <h3 className="text-xl font-display font-bold text-white">
                          {isFirst ? 'New Discovery!' : 'Already Collected'}
                        </h3>
                        <p className="text-brand-400 font-semibold mt-1">
                          {species?.commonName || species?.scientificName || 'Unknown Species'}
                        </p>
                        {species?.scientificName && species?.commonName && (
                          <p className="text-gray-500 text-sm italic">{species.scientificName}</p>
                        )}
                      </div>

                      <div className="flex items-center justify-center gap-4 text-sm">
                        {species?.rarityTier && (
                          <span className={cn(
                            "px-2 py-1 rounded-full text-xs font-bold",
                            species.rarityTier === 'COMMON' && "bg-gray-600/30 text-gray-300",
                            species.rarityTier === 'UNCOMMON' && "bg-green-600/30 text-green-300",
                            species.rarityTier === 'RARE' && "bg-blue-600/30 text-blue-300",
                            species.rarityTier === 'EPIC' && "bg-purple-600/30 text-purple-300",
                            species.rarityTier === 'LEGENDARY' && "bg-orange-600/30 text-orange-300",
                            species.rarityTier === 'MYTHIC' && "bg-red-600/30 text-red-300",
                          )}>
                            {species.rarityTier}
                          </span>
                        )}
                        {confidence && (
                          <span className="text-gray-400">{(confidence * 100).toFixed(0)}% match</span>
                        )}
                      </div>

                      {isFirst && points > 0 && (
                        <div className="text-2xl font-bold text-brand-400">+{points} pts</div>
                      )}

                      <div className="flex gap-3 pt-4">
                        <Button variant="secondary" size="lg" className="flex-1" onClick={() => { handleReset(); }}>
                          Capture More
                        </Button>
                        <Button variant="default" size="lg" className="flex-1" onClick={() => { handleReset(); onClose(); }}>
                          Done
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
