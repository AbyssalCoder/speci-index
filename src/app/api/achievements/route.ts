import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const admin = getAdminClient();

    const [allResult, unlockedResult] = await Promise.all([
      admin
        .from('achievements')
        .select('*')
        .order('name', { ascending: true }),
      admin
        .from('user_achievements')
        .select('achievementId, unlockedAt')
        .eq('userId', user.id),
    ]);

    if (allResult.error) throw allResult.error;
    if (unlockedResult.error) throw unlockedResult.error;

    const all = allResult.data ?? [];
    const unlocked = unlockedResult.data ?? [];

    const unlockedMap = new Map(unlocked.map((u: Record<string, unknown>) => [u.achievementId as string, u.unlockedAt as string]));

    const data = all.map((a: Record<string, unknown>) => ({
      id: a.id,
      slug: a.slug,
      name: a.name,
      description: a.description,
      iconUrl: a.iconUrl,
      category: a.category,
      rarity: a.rarity,
      unlocked: unlockedMap.has(a.id as string),
      unlockedAt: unlockedMap.get(a.id as string) ?? null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Achievements error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
