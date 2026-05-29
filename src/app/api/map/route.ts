import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const south = parseFloat(searchParams.get('south') ?? '-90');
    const north = parseFloat(searchParams.get('north') ?? '90');
    const west = parseFloat(searchParams.get('west') ?? '-180');
    const east = parseFloat(searchParams.get('east') ?? '180');
    const limit = Math.min(500, parseInt(searchParams.get('limit') ?? '200'));

    const admin = getAdminClient();

    // Get discoveries within the bounding box
    const { data: discoveries, error: discError } = await admin
      .from('discoveries')
      .select('id, latitude, longitude, firstSeenAt, species:species(commonName, category, rarityTier), user:users(username)')
      .gte('latitude', south)
      .lte('latitude', north)
      .gte('longitude', west)
      .lte('longitude', east)
      .order('firstSeenAt', { ascending: false })
      .limit(limit);

    if (discError) throw discError;

    const markers = (discoveries ?? []).map((d: Record<string, unknown>) => {
      const species = d.species as Record<string, unknown>;
      const user = d.user as Record<string, unknown>;
      return {
        id: d.id,
        latitude: d.latitude,
        longitude: d.longitude,
        species: {
          commonName: species.commonName,
          category: species.category,
          rarityTier: species.rarityTier,
        },
        discoveredBy: user.username,
        discoveredAt: d.firstSeenAt,
      };
    });

    // Get restricted zones in view
    const { data: zones, error: zoneError } = await admin
      .from('restricted_zones')
      .select('*')
      .eq('isActive', true)
      .gte('latitude', south)
      .lte('latitude', north)
      .gte('longitude', west)
      .lte('longitude', east);

    if (zoneError) throw zoneError;

    return NextResponse.json({
      success: true,
      data: { markers, restrictedZones: zones ?? [] },
    });
  } catch (error) {
    console.error('Map error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
