import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') ?? 'date';

    const where: Record<string, unknown> = { userId: user.id };

    const discoveries = await prisma.discovery.findMany({
      where,
      include: {
        species: true,
        submission: {
          select: { imageUrl: true, thumbnailUrl: true },
        },
      },
      orderBy: sort === 'rarity'
        ? { species: { rarityPoints: 'desc' } }
        : sort === 'name'
          ? { species: { commonName: 'asc' } }
          : { firstSeenAt: 'desc' },
    });

    let filtered = discoveries;

    if (category) {
      filtered = filtered.filter((d) => d.species.category === category);
    }

    if (search) {
      const term = search.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.species.commonName.toLowerCase().includes(term) ||
          d.species.scientificName.toLowerCase().includes(term)
      );
    }

    return NextResponse.json({
      success: true,
      data: filtered.map((d) => ({
        id: d.id,
        species: {
          id: d.species.id,
          scientificName: d.species.scientificName,
          commonName: d.species.commonName,
          category: d.species.category,
          conservationStatus: d.species.conservationStatus,
          habitat: d.species.habitat,
          regions: d.species.regions,
          description: d.species.description,
          rarityPoints: d.species.rarityPoints,
          rarityTier: d.species.rarityTier,
          imageUrl: d.species.imageUrl,
        },
        firstSeenAt: d.firstSeenAt,
        pointsEarned: d.pointsEarned,
        latitude: d.latitude,
        longitude: d.longitude,
        locationName: d.locationName,
        imageUrl: d.submission.imageUrl,
        thumbnailUrl: d.submission.thumbnailUrl,
      })),
    });
  } catch (error) {
    console.error('Collection fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
