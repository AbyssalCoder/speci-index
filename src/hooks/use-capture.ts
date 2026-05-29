'use client';

import { useCallback, useRef, useState } from 'react';
import { useAppStore } from '@/stores/app-store';

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [facing, setFacing] = useState<'user' | 'environment'>('environment');

  const start = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
      setStream(mediaStream);
      setIsActive(true);
    } catch (err) {
      console.error('Camera access denied:', err);
      throw new Error('Camera access denied');
    }
  }, [facing]);

  const stop = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
      setIsActive(false);
    }
  }, [stream]);

  const capture = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1]; // base64 only
  }, []);

  const toggleFacing = useCallback(async () => {
    stop();
    setFacing((f) => (f === 'user' ? 'environment' : 'user'));
    // Will restart with new facing on next start()
  }, [stop]);

  return { videoRef, canvasRef, stream, isActive, start, stop, capture, toggleFacing, facing };
}

export function useGeolocation() {
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getCurrentPosition = useCallback((): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        setError('Geolocation not supported');
        reject(new Error('Geolocation not supported'));
        return;
      }

      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setPosition(coords);
          setLoading(false);
          resolve(coords);
        },
        (err) => {
          setError(err.message);
          setLoading(false);
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    });
  }, []);

  return { position, error, loading, getCurrentPosition };
}

export function useSubmission() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const addToQueue = useAppStore((s) => s.addToQueue);

  const submit = useCallback(
    async (imageBase64: string, latitude?: number, longitude?: number) => {
      setIsSubmitting(true);
      setError(null);
      setResult(null);

      // Check online status
      if (!navigator.onLine) {
        addToQueue({ imageBase64, latitude, longitude });
        setIsSubmitting(false);
        return { queued: true };
      }

      try {
        const res = await fetch('/api/submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64,
            latitude,
            longitude,
            deviceInfo: {
              platform: navigator.platform,
              userAgent: navigator.userAgent,
            },
          }),
        });

        if (!res.ok) {
          // Handle HTTP errors (413 body too large, 500, etc.)
          let errorMsg = `Server error (${res.status})`;
          try {
            const errData = await res.json();
            errorMsg = errData.error || errorMsg;
          } catch { /* ignore parse error */ }
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        const data = await res.json();
        if (!data.success) {
          setError(data.error || 'Submission failed');
        }
        setResult(data.data);
        return data;
      } catch (err) {
        console.error('Submission fetch error:', err);
        if (!navigator.onLine) {
          addToQueue({ imageBase64, latitude, longitude });
          setError('No connection. Queued for later.');
          return { queued: true };
        }
        const errorMsg = 'Request failed. Please try again.';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsSubmitting(false);
      }
    },
    [addToQueue]
  );

  return { submit, isSubmitting, result, error };
}
