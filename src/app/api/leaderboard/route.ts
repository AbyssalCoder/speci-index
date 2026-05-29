import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope') ?? 'global';
    const country = searchParams.get('country');
    const state = searchParams.get('state');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '50')));

    const admin = getAdminClient();
    let query = admin
      .from('users')
      .select('id, username, displayName, avatarUrl, country, totalPoints, speciesCount, level', { count: 'exact' })
      .eq('isBanned', false);

    if (scope === 'country' && country) {
      query = query.eq('country', country);
    } else if (scope === 'state' && country && state) {
      query = query.eq('country', country).eq('state', state);
    }

    query = query
      .order('totalPoints', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    const { data: users, count: total, error } = await query;
    if (error) throw error;

    const startRank = (page - 1) * pageSize + 1;
    const items = (users ?? []).map((u: Record<string, unknown>, i: number) => ({
      rank: startRank + i,
      user: {
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        country: u.country,
      },
      totalPoints: u.totalPoints,
      speciesCount: u.speciesCount,
      level: u.level,
    }));

    return NextResponse.json({
      success: true,
      data: { items, total: total ?? 0, page, pageSize, hasMore: page * pageSize < (total ?? 0) },
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
