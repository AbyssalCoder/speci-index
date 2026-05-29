import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const all = await prisma.achievement.findMany({ orderBy: { name: 'asc' } });
    const unlocked = await prisma.userAchievement.findMany({
      where: { userId: user.id },
      select: { achievementId: true, unlockedAt: true },
    });

    const unlockedMap = new Map(unlocked.map((u) => [u.achievementId, u.unlockedAt]));

    const data = all.map((a) => ({
      id: a.id,
      slug: a.slug,
      name: a.name,
      description: a.description,
      iconUrl: a.iconUrl,
      category: a.category,
      rarity: a.rarity,
      unlocked: unlockedMap.has(a.id),
      unlockedAt: unlockedMap.get(a.id)?.toISOString() ?? null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Achievements error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
