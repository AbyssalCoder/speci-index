import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
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

    const admin = getAdminClient();

    // Check if user already in a clan
    const { data: existing } = await admin
      .from('clan_members')
      .select('id')
      .eq('userId', user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: false, error: 'Already in a clan' }, { status: 409 });
    }

    // Create clan
    const { data: clan, error: clanError } = await admin
      .from('clans')
      .insert({
        ...parsed.data,
        memberCount: 1,
        updatedAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (clanError || !clan) throw clanError;

    // Add user as leader
    await admin
      .from('clan_members')
      .insert({ clanId: clan.id, userId: user.id, role: 'LEADER' });

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

    const admin = getAdminClient();

    const { data: clans, count: total, error } = await admin
      .from('clans')
      .select('*, members:clan_members(role, user:users(username, displayName))', { count: 'exact' })
      .eq('isPublic', true)
      .order('totalPoints', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: { items: clans ?? [], total: total ?? 0, page, pageSize, hasMore: page * pageSize < (total ?? 0) },
    });
  } catch (error) {
    console.error('Clan list error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
