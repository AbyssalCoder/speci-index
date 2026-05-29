import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    const admin = getAdminClient();
    const now = new Date().toISOString();

    let questQuery = admin
      .from('quests')
      .select('*')
      .eq('isActive', true)
      .lte('startsAt', now)
      .gte('endsAt', now)
      .order('endsAt', { ascending: true });

    if (type) {
      questQuery = questQuery.eq('type', type);
    }

    const { data: quests, error: questError } = await questQuery;
    if (questError) throw questError;

    const questList = quests ?? [];
    const questIds = questList.map((q: Record<string, unknown>) => q.id as string);

    let progress: Record<string, unknown>[] = [];
    if (questIds.length > 0) {
      const { data: progressData, error: progressError } = await admin
        .from('quest_progress')
        .select('*')
        .eq('userId', user.id)
        .in('questId', questIds);

      if (progressError) throw progressError;
      progress = progressData ?? [];
    }

    const progressMap = new Map(progress.map((p) => [p.questId as string, p]));

    const data = questList.map((q: Record<string, unknown>) => {
      const p = progressMap.get(q.id as string);
      return {
        id: q.id,
        title: q.title,
        description: q.description,
        type: q.type,
        requirement: q.requirement,
        xpReward: q.xpReward,
        pointReward: q.pointReward,
        endsAt: q.endsAt,
        progress: (p as Record<string, unknown>)?.progress ?? 0,
        completed: (p as Record<string, unknown>)?.completed ?? false,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Quests error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
