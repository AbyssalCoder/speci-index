import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const createClanSchema = z.object({
  name: z.string().min(3).max(30),
  tag: z.string().min(2).max(6).regex(/^[A-Z0-9]+$/),
  description: z.string().max(280).optional(),
  isPublic: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const parsed = createClanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    // Check if user already in a clan
    const existing = await prisma.clanMember.findFirst({ where: { userId: user.id } });
    if (existing) {
      return NextResponse.json({ success: false, error: 'Already in a clan' }, { status: 409 });
    }

    const clan = await prisma.$transaction(async (tx) => {
      const clan = await tx.clan.create({
        data: {
          ...parsed.data,
          memberCount: 1,
        },
      });
      await tx.clanMember.create({
        data: { clanId: clan.id, userId: user.id, role: 'LEADER' },
      });
      return clan;
    });

    return NextResponse.json({ success: true, data: clan });
  } catch (error) {
    console.error('Clan create error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(50, parseInt(searchParams.get('pageSize') ?? '20'));

    const [clans, total] = await Promise.all([
      prisma.clan.findMany({
        where: { isPublic: true },
        orderBy: { totalPoints: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          members: {
            where: { role: 'LEADER' },
            include: {
              user: { select: { username: true, displayName: true } },
            },
          },
        },
      }),
      prisma.clan.count({ where: { isPublic: true } }),
    ]);

    return NextResponse.json({
      success: true,
      data: { items: clans, total, page, pageSize, hasMore: page * pageSize < total },
    });
  } catch (error) {
    console.error('Clan list error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
