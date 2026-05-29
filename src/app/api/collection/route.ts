import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

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

    const admin = getAdminClient();

    let query = admin
      .from('discoveries')
      .select('*, species:species(*), submission:submissions(imageUrl, thumbnailUrl)')
      .eq('userId', user.id);

    if (sort === 'date') {
      query = query.order('firstSeenAt', { ascending: false });
    }

    const { data: discoveries, error } = await query;
    if (error) throw error;

    let filtered = discoveries ?? [];

    // Sort by species fields client-side (Supabase can't order by joined columns easily)
    if (sort === 'rarity') {
      filtered.sort((a: Record<string, any>, b: Record<string, any>) =>
        (b.species?.rarityPoints ?? 0) - (a.species?.rarityPoints ?? 0));
    } else if (sort === 'name') {
      filtered.sort((a: Record<string, any>, b: Record<string, any>) =>
        (a.species?.commonName ?? '').localeCompare(b.species?.commonName ?? ''));
    }

    if (category) {
      filtered = filtered.filter((d: Record<string, any>) => d.species?.category === category);
    }

    if (search) {
      const term = search.toLowerCase();
      filtered = filtered.filter(
        (d: Record<string, any>) =>
          d.species?.commonName?.toLowerCase().includes(term) ||
          d.species?.scientificName?.toLowerCase().includes(term)
      );
    }

    return NextResponse.json({
      success: true,
      data: filtered.map((d: Record<string, any>) => ({
        id: d.id,
        species: d.species ? {
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
        } : null,
        firstSeenAt: d.firstSeenAt,
        pointsEarned: d.pointsEarned,
        latitude: d.latitude,
        longitude: d.longitude,
        locationName: d.locationName,
        imageUrl: d.submission?.imageUrl,
        thumbnailUrl: d.submission?.thumbnailUrl,
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
