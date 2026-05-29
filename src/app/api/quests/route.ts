import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    const where: Record<string, unknown> = { isActive: true };
    if (type) where.type = type;

    const now = new Date();
    const quests = await prisma.quest.findMany({
      where: {
        ...where,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      orderBy: { endsAt: 'asc' },
    });

    const questIds = quests.map((q) => q.id);
    const progress = await prisma.questProgress.findMany({
      where: { userId: user.id, questId: { in: questIds } },
    });

    const progressMap = new Map(progress.map((p) => [p.questId, p]));

    const data = quests.map((q) => {
      const p = progressMap.get(q.id);
      return {
        id: q.id,
        title: q.title,
        description: q.description,
        type: q.type,
        requirement: q.requirement,
        xpReward: q.xpReward,
        pointReward: q.pointReward,
        endsAt: q.endsAt,
        progress: p?.progress ?? 0,
        completed: p?.completed ?? false,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Quests error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
