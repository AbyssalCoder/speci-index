import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

const registerSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  displayName: z.string().min(1).max(50),
  country: z.string().length(2).optional(),
  state: z.string().max(100).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { username, displayName, country, state } = parsed.data;

    const admin = getAdminClient();

    // Check username uniqueness
    const { data: existing } = await admin
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Username already taken' },
        { status: 409 }
      );
    }

    const { data: profile, error } = await admin
      .from('users')
      .insert({
        id: user.id,
        email: user.email,
        username,
        displayName,
        country: country || null,
        state: state || null,
        updatedAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Registration insert error:', error);
      return NextResponse.json(
        { success: false, error: 'Profile creation failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
