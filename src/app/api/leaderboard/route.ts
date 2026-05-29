import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope') ?? 'global';
    const country = searchParams.get('country');
    const state = searchParams.get('state');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '50')));

    const where: Record<string, unknown> = { isBanned: false };

    if (scope === 'country' && country) {
      where.country = country;
    } else if (scope === 'state' && country && state) {
      where.country = country;
      where.state = state;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          country: true,
          totalPoints: true,
          speciesCount: true,
          level: true,
        },
        orderBy: { totalPoints: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    const startRank = (page - 1) * pageSize + 1;
    const items = users.map((u, i) => ({
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
      data: { items, total, page, pageSize, hasMore: page * pageSize < total },
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
