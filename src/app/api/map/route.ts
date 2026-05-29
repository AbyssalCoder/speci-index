import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const south = parseFloat(searchParams.get('south') ?? '-90');
    const north = parseFloat(searchParams.get('north') ?? '90');
    const west = parseFloat(searchParams.get('west') ?? '-180');
    const east = parseFloat(searchParams.get('east') ?? '180');
    const limit = Math.min(500, parseInt(searchParams.get('limit') ?? '200'));

    // Get discoveries within the bounding box
    const discoveries = await prisma.discovery.findMany({
      where: {
        latitude: { gte: south, lte: north },
        longitude: { gte: west, lte: east },
      },
      include: {
        species: {
          select: { commonName: true, category: true, rarityTier: true },
        },
        user: {
          select: { username: true },
        },
      },
      take: limit,
      orderBy: { firstSeenAt: 'desc' },
    });

    const markers = discoveries.map((d) => ({
      id: d.id,
      latitude: d.latitude!,
      longitude: d.longitude!,
      species: {
        commonName: d.species.commonName,
        category: d.species.category,
        rarityTier: d.species.rarityTier,
      },
      discoveredBy: d.user.username,
      discoveredAt: d.firstSeenAt.toISOString(),
    }));

    // Get restricted zones in view
    const zones = await prisma.restrictedZone.findMany({
      where: {
        isActive: true,
        latitude: { gte: south, lte: north },
        longitude: { gte: west, lte: east },
      },
    });

    return NextResponse.json({
      success: true,
      data: { markers, restrictedZones: zones },
    });
  } catch (error) {
    console.error('Map error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
