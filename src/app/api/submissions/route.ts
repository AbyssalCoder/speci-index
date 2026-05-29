import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { validateSubmission } from '@/lib/anticheat';
import { checkRestrictedZone } from '@/lib/geofencing';
import { calculateRarityPoints, getRarityTierFromPoints } from '@/lib/rarity';

const submitSchema = z.object({
  imageBase64: z.string().min(1),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  deviceInfo: z.object({
    platform: z.string().optional(),
    deviceId: z.string().optional(),
    userAgent: z.string().optional(),
  }).optional(),
  exifData: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser || dbUser.isBanned) {
      return NextResponse.json({ success: false, error: 'Account suspended' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid submission data' },
        { status: 400 }
      );
    }

    const { imageBase64, latitude, longitude, deviceInfo, exifData } = parsed.data;

    // Rate limit: max 30 submissions per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await prisma.submission.count({
      where: { userId: user.id, createdAt: { gte: oneHourAgo } },
    });
    if (recentCount >= 30) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Max 30 submissions per hour.' },
        { status: 429 }
      );
    }

    // Upload image to Supabase Storage
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('submissions')
      .upload(fileName, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { success: false, error: 'Image upload failed' },
        { status: 500 }
      );
    }

    const { data: { publicUrl } } = supabase.storage
      .from('submissions')
      .getPublicUrl(fileName);

    // Create initial submission record
    const submission = await prisma.submission.create({
      data: {
        userId: user.id,
        imageUrl: publicUrl,
        status: 'PROCESSING',
        latitude,
        longitude,
        exifData: exifData ? (exifData as any) : undefined,
        deviceInfo: deviceInfo ? (deviceInfo as any) : undefined,
      },
    });

    // Anti-cheat validation
    const validation = await validateSubmission({
      imageBase64,
      userId: user.id,
      exifData,
      latitude,
      longitude,
      deviceInfo,
    });

    if (!validation.isValid) {
      await prisma.submission.update({
        where: { id: submission.id },
        data: {
          status: 'REJECTED',
          aiRejectionReason: validation.rejectionReason,
          fraudScore: validation.fraudScore,
        },
      });

      return NextResponse.json({
        success: false,
        error: validation.rejectionReason,
        data: { id: submission.id, status: 'REJECTED' },
      });
    }

    // AI Species Identification (call AI microservice)
    let aiResult;
    try {
      const aiResponse = await fetch(`${process.env.AI_SERVICE_URL}/identify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.AI_SERVICE_API_KEY}`,
        },
        body: JSON.stringify({ image: imageBase64 }),
      });
      aiResult = await aiResponse.json();
    } catch {
      await prisma.submission.update({
        where: { id: submission.id },
        data: { status: 'PENDING', aiRejectionReason: 'AI service unavailable' },
      });
      return NextResponse.json({
        success: true,
        data: { id: submission.id, status: 'PENDING', message: 'Queued for processing' },
      });
    }

    // Validate AI result
    if (!aiResult.species || aiResult.confidence < 0.7) {
      await prisma.submission.update({
        where: { id: submission.id },
        data: {
          status: 'REJECTED',
          aiConfidence: aiResult.confidence,
          aiSpeciesGuess: aiResult.species?.scientificName,
          aiRejectionReason: aiResult.confidence < 0.7
            ? `Low confidence: ${(aiResult.confidence * 100).toFixed(1)}%`
            : 'Species not identified',
        },
      });
      return NextResponse.json({
        success: false,
        error: 'Could not identify species with sufficient confidence',
        data: { id: submission.id, status: 'REJECTED', confidence: aiResult.confidence },
      });
    }

    // Reject humans and trees
    if (aiResult.isHuman) {
      await prisma.submission.update({
        where: { id: submission.id },
        data: { status: 'REJECTED', aiRejectionReason: 'Human detected — only non-human species allowed' },
      });
      return NextResponse.json({
        success: false,
        error: 'Human detected. Only non-human species are allowed.',
        data: { id: submission.id, status: 'REJECTED' },
      });
    }

    if (aiResult.isTree) {
      await prisma.submission.update({
        where: { id: submission.id },
        data: { status: 'REJECTED', aiRejectionReason: 'Trees are not collectible species' },
      });
      return NextResponse.json({
        success: false,
        error: 'Trees are not collectible. Flowers, fungi, and other species are welcome!',
        data: { id: submission.id, status: 'REJECTED' },
      });
    }

    // Find or create species record
    let species = await prisma.species.findUnique({
      where: { scientificName: aiResult.species.scientificName },
    });

    if (!species) {
      const rarityPoints = calculateRarityPoints({
        conservationStatus: aiResult.species.conservationStatus ?? 'LC',
        globalObservationCount: aiResult.species.observationCount ?? 1000000,
        regionRarity: 1.0,
        seasonalBonus: 1.0,
        eventMultiplier: 1.0,
      });

      species = await prisma.species.create({
        data: {
          scientificName: aiResult.species.scientificName,
          commonName: aiResult.species.commonName,
          category: aiResult.species.category ?? 'OTHER',
          conservationStatus: aiResult.species.conservationStatus ?? 'LC',
          habitat: aiResult.species.habitat,
          regions: aiResult.species.regions ?? [],
          description: aiResult.species.description,
          rarityPoints,
          rarityTier: getRarityTierFromPoints(rarityPoints),
          isVerified: false,
        },
      });
    }

    // Check restricted zone
    let isRestrictedZone = false;
    let pointMultiplier = 1.0;
    if (latitude && longitude) {
      const zoneCheck = await checkRestrictedZone(latitude, longitude);
      isRestrictedZone = zoneCheck.isRestricted;
      pointMultiplier = zoneCheck.pointMultiplier;
    }

    // Check if first discovery
    const existingDiscovery = await prisma.discovery.findUnique({
      where: { userId_speciesId: { userId: user.id, speciesId: species.id } },
    });

    const isFirstDiscovery = !existingDiscovery;
    let pointsAwarded = 0;

    if (isFirstDiscovery) {
      pointsAwarded = Math.round(species.rarityPoints * pointMultiplier);
    }

    // Update submission
    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: 'ACCEPTED',
        speciesId: species.id,
        aiConfidence: aiResult.confidence,
        aiSpeciesGuess: aiResult.species.scientificName,
        isRestrictedZone,
        isFirstDiscovery,
        pointsAwarded,
        isDuplicate: !isFirstDiscovery,
        perceptualHash: validation.perceptualHash,
      },
    });

    // Create discovery + update user stats (only if first discovery)
    if (isFirstDiscovery) {
      await prisma.$transaction([
        prisma.discovery.create({
          data: {
            userId: user.id,
            speciesId: species.id,
            pointsEarned: pointsAwarded,
            latitude,
            longitude,
            submissionId: submission.id,
          },
        }),
        prisma.user.update({
          where: { id: user.id },
          data: {
            totalPoints: { increment: pointsAwarded },
            speciesCount: { increment: 1 },
            xp: { increment: Math.round(pointsAwarded * 0.5) + 10 },
          },
        }),
      ]);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: submission.id,
        status: 'ACCEPTED',
        species: {
          id: species.id,
          scientificName: species.scientificName,
          commonName: species.commonName,
          category: species.category,
          conservationStatus: species.conservationStatus,
          rarityTier: species.rarityTier,
          rarityPoints: species.rarityPoints,
        },
        isFirstDiscovery,
        pointsAwarded,
        isRestrictedZone,
        aiConfidence: aiResult.confidence,
      },
    });
  } catch (error) {
    console.error('Submission error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get user's submissions
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20')));
    const status = searchParams.get('status') as string | null;

    const where: Record<string, unknown> = { userId: user.id };
    if (status) where.status = status;

    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where,
        include: {
          species: {
            select: {
              id: true,
              scientificName: true,
              commonName: true,
              category: true,
              conservationStatus: true,
              rarityTier: true,
              rarityPoints: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.submission.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: submissions,
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
      },
    });
  } catch (error) {
    console.error('Submissions fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
