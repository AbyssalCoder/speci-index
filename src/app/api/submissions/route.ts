import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
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

    const admin = getAdminClient();

    const { data: dbUser } = await admin
      .from('users')
      .select('id, isBanned')
      .eq('id', user.id)
      .maybeSingle();

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
    const { count: recentCount } = await admin
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('userId', user.id)
      .gte('createdAt', oneHourAgo.toISOString());

    if ((recentCount ?? 0) >= 30) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Max 30 submissions per hour.' },
        { status: 429 }
      );
    }

    // Upload image to Supabase Storage
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

    const { error: uploadError } = await supabase.storage
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
    const { data: submission, error: subError } = await admin
      .from('submissions')
      .insert({
        userId: user.id,
        imageUrl: publicUrl,
        status: 'PROCESSING',
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        exifData: exifData ?? null,
        deviceInfo: deviceInfo ?? null,
        updatedAt: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (subError || !submission) throw subError;

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
      await admin
        .from('submissions')
        .update({
          status: 'REJECTED',
          aiRejectionReason: validation.rejectionReason,
          fraudScore: validation.fraudScore,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', submission.id);

      return NextResponse.json({
        success: false,
        error: validation.rejectionReason,
        data: { id: submission.id, status: 'REJECTED' },
      });
    }

    // AI Species Identification
    let aiResult: any;
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
      await admin
        .from('submissions')
        .update({ status: 'PENDING', aiRejectionReason: 'AI service unavailable', updatedAt: new Date().toISOString() })
        .eq('id', submission.id);
      return NextResponse.json({
        success: true,
        data: { id: submission.id, status: 'PENDING', message: 'Queued for processing' },
      });
    }

    // Validate AI result
    if (!aiResult.species || aiResult.confidence < 0.7) {
      await admin
        .from('submissions')
        .update({
          status: 'REJECTED',
          aiConfidence: aiResult.confidence,
          aiSpeciesGuess: aiResult.species?.scientificName,
          aiRejectionReason: aiResult.confidence < 0.7
            ? `Low confidence: ${(aiResult.confidence * 100).toFixed(1)}%`
            : 'Species not identified',
          updatedAt: new Date().toISOString(),
        })
        .eq('id', submission.id);
      return NextResponse.json({
        success: false,
        error: 'Could not identify species with sufficient confidence',
        data: { id: submission.id, status: 'REJECTED', confidence: aiResult.confidence },
      });
    }

    // Reject humans and trees
    if (aiResult.isHuman) {
      await admin
        .from('submissions')
        .update({ status: 'REJECTED', aiRejectionReason: 'Human detected — only non-human species allowed', updatedAt: new Date().toISOString() })
        .eq('id', submission.id);
      return NextResponse.json({
        success: false,
        error: 'Human detected. Only non-human species are allowed.',
        data: { id: submission.id, status: 'REJECTED' },
      });
    }

    if (aiResult.isTree) {
      await admin
        .from('submissions')
        .update({ status: 'REJECTED', aiRejectionReason: 'Trees are not collectible species', updatedAt: new Date().toISOString() })
        .eq('id', submission.id);
      return NextResponse.json({
        success: false,
        error: 'Trees are not collectible. Flowers, fungi, and other species are welcome!',
        data: { id: submission.id, status: 'REJECTED' },
      });
    }

    // Find or create species record
    let { data: species } = await admin
      .from('species')
      .select('*')
      .eq('scientificName', aiResult.species.scientificName)
      .maybeSingle();

    if (!species) {
      const rarityPoints = calculateRarityPoints({
        conservationStatus: aiResult.species.conservationStatus ?? 'LC',
        globalObservationCount: aiResult.species.observationCount ?? 1000000,
        regionRarity: 1.0,
        seasonalBonus: 1.0,
        eventMultiplier: 1.0,
      });

      const { data: newSpecies } = await admin
        .from('species')
        .insert({
          scientificName: aiResult.species.scientificName,
          commonName: aiResult.species.commonName,
          category: aiResult.species.category ?? 'OTHER',
          conservationStatus: aiResult.species.conservationStatus ?? 'LC',
          habitat: aiResult.species.habitat ?? null,
          regions: aiResult.species.regions ?? [],
          description: aiResult.species.description ?? null,
          rarityPoints,
          rarityTier: getRarityTierFromPoints(rarityPoints),
          isVerified: false,
          updatedAt: new Date().toISOString(),
        })
        .select('*')
        .single();

      species = newSpecies;
    }

    if (!species) throw new Error('Failed to find or create species');

    // Check restricted zone
    let isRestrictedZone = false;
    let pointMultiplier = 1.0;
    if (latitude && longitude) {
      const zoneCheck = await checkRestrictedZone(latitude, longitude);
      isRestrictedZone = zoneCheck.isRestricted;
      pointMultiplier = zoneCheck.pointMultiplier;
    }

    // Check if first discovery
    const { data: existingDiscovery } = await admin
      .from('discoveries')
      .select('id')
      .eq('userId', user.id)
      .eq('speciesId', species.id)
      .maybeSingle();

    const isFirstDiscovery = !existingDiscovery;
    let pointsAwarded = 0;

    if (isFirstDiscovery) {
      pointsAwarded = Math.round(species.rarityPoints * pointMultiplier);
    }

    // Update submission
    await admin
      .from('submissions')
      .update({
        status: 'ACCEPTED',
        speciesId: species.id,
        aiConfidence: aiResult.confidence,
        aiSpeciesGuess: aiResult.species.scientificName,
        isRestrictedZone,
        isFirstDiscovery,
        pointsAwarded,
        isDuplicate: !isFirstDiscovery,
        perceptualHash: validation.perceptualHash,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', submission.id);

    // Create discovery + update user stats (only if first discovery)
    if (isFirstDiscovery) {
      await admin
        .from('discoveries')
        .insert({
          userId: user.id,
          speciesId: species.id,
          pointsEarned: pointsAwarded,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          submissionId: submission.id,
          updatedAt: new Date().toISOString(),
        });

      // Fetch current user stats and increment
      const { data: currentUser } = await admin
        .from('users')
        .select('totalPoints, speciesCount, xp')
        .eq('id', user.id)
        .single();

      if (currentUser) {
        await admin
          .from('users')
          .update({
            totalPoints: (currentUser.totalPoints ?? 0) + pointsAwarded,
            speciesCount: (currentUser.speciesCount ?? 0) + 1,
            xp: (currentUser.xp ?? 0) + Math.round(pointsAwarded * 0.5) + 10,
            updatedAt: new Date().toISOString(),
          })
          .eq('id', user.id);
      }
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

    const admin = getAdminClient();
    let query = admin
      .from('submissions')
      .select('*, species:species(id, scientificName, commonName, category, conservationStatus, rarityTier, rarityPoints)', { count: 'exact' })
      .eq('userId', user.id);

    if (status) query = query.eq('status', status);

    query = query
      .order('createdAt', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    const { data: submissions, count: total, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: {
        items: submissions ?? [],
        total: total ?? 0,
        page,
        pageSize,
        hasMore: page * pageSize < (total ?? 0),
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
