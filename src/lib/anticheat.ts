/**
 * Anti-Cheat System
 * - EXIF validation
 * - Perceptual hash duplicate detection
 * - Device trust scoring
 * - GPS spoofing detection
 * - Rate limiting
 */

import { prisma } from '@/lib/db';

interface SubmissionValidation {
  imageBase64: string;
  userId: string;
  exifData?: Record<string, unknown>;
  latitude?: number;
  longitude?: number;
  deviceInfo?: {
    platform?: string;
    deviceId?: string;
    userAgent?: string;
  };
}

interface ValidationResult {
  isValid: boolean;
  rejectionReason: string | null;
  fraudScore: number;
  perceptualHash: string | null;
  flags: string[];
}

export async function validateSubmission(input: SubmissionValidation): Promise<ValidationResult> {
  const flags: string[] = [];
  let fraudScore = 0;

  // 1. EXIF Validation
  if (process.env.EXIF_VALIDATION_ENABLED === 'true') {
    const exifResult = validateExif(input.exifData);
    fraudScore += exifResult.score;
    flags.push(...exifResult.flags);
  }

  // 2. GPS Spoofing Detection
  if (input.latitude && input.longitude && input.exifData) {
    const gpsResult = detectGpsSpoofing(input);
    fraudScore += gpsResult.score;
    flags.push(...gpsResult.flags);
  }

  // 3. Device Trust Check
  if (input.deviceInfo?.deviceId) {
    const deviceResult = await checkDeviceTrust(input.userId, input.deviceInfo);
    fraudScore += deviceResult.score;
    flags.push(...deviceResult.flags);
  }

  // 4. Submission Velocity Check
  const velocityResult = await checkSubmissionVelocity(input.userId);
  fraudScore += velocityResult.score;
  flags.push(...velocityResult.flags);

  // 5. Perceptual Hash Duplicate Check
  let perceptualHash: string | null = null;
  try {
    const aiResponse = await fetch(`${process.env.AI_SERVICE_URL}/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.AI_SERVICE_API_KEY}`,
      },
      body: JSON.stringify({ image: input.imageBase64 }),
    });
    const aiValidation = await aiResponse.json();

    perceptualHash = aiValidation.perceptualHash || null;

    if (!aiValidation.isValid) {
      return {
        isValid: false,
        rejectionReason: aiValidation.rejectionReason || 'Image validation failed',
        fraudScore: Math.min(1, fraudScore),
        perceptualHash,
        flags,
      };
    }

    if (aiValidation.isScreenshot) {
      flags.push('screenshot_detected');
      fraudScore += 0.5;
    }

    if (aiValidation.isAIGenerated) {
      return {
        isValid: false,
        rejectionReason: 'AI-generated images are not allowed',
        fraudScore: 1.0,
        perceptualHash,
        flags: [...flags, 'ai_generated'],
      };
    }

    // Check for duplicate hash in database
    if (perceptualHash) {
      const duplicate = await checkDuplicateHash(perceptualHash, input.userId);
      if (duplicate) {
        flags.push('duplicate_hash');
        fraudScore += 0.3;
      }
    }
  } catch {
    // AI service unavailable — continue without AI validation
    flags.push('ai_validation_skipped');
  }

  // Final determination
  const normalizedScore = Math.min(1, fraudScore);

  if (normalizedScore >= 0.8) {
    // Update user trust score
    await updateUserTrustScore(input.userId, -0.1);

    return {
      isValid: false,
      rejectionReason: 'Submission flagged for suspicious activity',
      fraudScore: normalizedScore,
      perceptualHash,
      flags,
    };
  }

  if (normalizedScore >= 0.5) {
    flags.push('needs_review');
  }

  return {
    isValid: true,
    rejectionReason: null,
    fraudScore: normalizedScore,
    perceptualHash,
    flags,
  };
}

function validateExif(exifData?: Record<string, unknown>): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;

  if (!exifData) {
    flags.push('no_exif');
    score += 0.1;
    return { score, flags };
  }

  // Check for camera make/model
  if (!exifData.make && !exifData.model) {
    flags.push('no_camera_info');
    score += 0.05;
  }

  // Check for suspicious software
  const software = String(exifData.software ?? '').toLowerCase();
  const suspiciousSoftware = ['photoshop', 'gimp', 'canva', 'picsart', 'snapseed'];
  if (suspiciousSoftware.some((s) => software.includes(s))) {
    flags.push('edited_software');
    score += 0.3;
  }

  // Check datetime consistency
  if (exifData.dateTime) {
    const photoDate = new Date(exifData.dateTime as string);
    const now = new Date();
    const diffHours = (now.getTime() - photoDate.getTime()) / (1000 * 60 * 60);

    // Photo from the future
    if (diffHours < -1) {
      flags.push('future_timestamp');
      score += 0.4;
    }

    // Very old photo (>30 days)
    if (diffHours > 24 * 30) {
      flags.push('old_photo');
      score += 0.1;
    }
  }

  return { score, flags };
}

function detectGpsSpoofing(input: SubmissionValidation): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;

  const exif = input.exifData;
  if (!exif) return { score, flags };

  // Compare submitted GPS with EXIF GPS
  if (exif.gpsLatitude != null && exif.gpsLongitude != null) {
    const exifLat = Number(exif.gpsLatitude);
    const exifLon = Number(exif.gpsLongitude);
    const subLat = input.latitude!;
    const subLon = input.longitude!;

    // Calculate distance between EXIF GPS and submitted GPS
    const R = 6371e3; // Earth radius in meters
    const dLat = ((subLat - exifLat) * Math.PI) / 180;
    const dLon = ((subLon - exifLon) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((exifLat * Math.PI) / 180) *
      Math.cos((subLat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // If more than 50km difference, suspicious
    if (distance > 50000) {
      flags.push('gps_mismatch');
      score += 0.5;
    } else if (distance > 10000) {
      flags.push('gps_drift');
      score += 0.2;
    }
  }

  return { score, flags };
}

async function checkDeviceTrust(
  userId: string,
  deviceInfo: { platform?: string; deviceId?: string; userAgent?: string }
): Promise<{ score: number; flags: string[] }> {
  const flags: string[] = [];
  let score = 0;

  if (!deviceInfo.deviceId) {
    flags.push('no_device_id');
    score += 0.1;
    return { score, flags };
  }

  // Check if device is known
  const session = await prisma.deviceSession.findUnique({
    where: { userId_deviceId: { userId, deviceId: deviceInfo.deviceId } },
  });

  if (!session) {
    // New device — register it
    await prisma.deviceSession.create({
      data: {
        userId,
        deviceId: deviceInfo.deviceId,
        platform: deviceInfo.platform,
        userAgent: deviceInfo.userAgent,
      },
    });
    flags.push('new_device');
    score += 0.05;
  } else if (!session.isTrusted) {
    flags.push('untrusted_device');
    score += 0.3;
  } else {
    // Update last active
    await prisma.deviceSession.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    });
  }

  // Check number of devices for user
  const deviceCount = await prisma.deviceSession.count({ where: { userId } });
  if (deviceCount > 5) {
    flags.push('many_devices');
    score += 0.15;
  }

  return { score, flags };
}

async function checkSubmissionVelocity(userId: string): Promise<{ score: number; flags: string[] }> {
  const flags: string[] = [];
  let score = 0;

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const recentCount = await prisma.submission.count({
    where: { userId, createdAt: { gte: fiveMinAgo } },
  });

  if (recentCount > 10) {
    flags.push('rapid_submissions');
    score += 0.4;
  } else if (recentCount > 5) {
    flags.push('fast_submissions');
    score += 0.15;
  }

  return { score, flags };
}

async function checkDuplicateHash(hash: string, userId: string): Promise<boolean> {
  // Check for exact or near-exact hash matches from same user
  const existing = await prisma.submission.findFirst({
    where: {
      userId,
      perceptualHash: hash,
      status: { in: ['ACCEPTED', 'PENDING', 'PROCESSING'] },
    },
  });
  return existing !== null;
}

async function updateUserTrustScore(userId: string, delta: number): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { trustScore: true },
  });

  if (user) {
    const newScore = Math.max(0, Math.min(1, user.trustScore + delta));
    await prisma.user.update({
      where: { id: userId },
      data: { trustScore: newScore },
    });
  }
}
