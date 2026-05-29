import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as any;

  if (token_hash && type) {
    const response = NextResponse.redirect(`${origin}/dashboard`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options as any);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.verifyOtp({ token_hash, type });

    if (!error) {
      // Create profile from metadata if it doesn't exist (via REST API)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const adminClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const { data: existing } = await adminClient
          .from('users')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();

        if (!existing) {
          const meta = user.user_metadata;
          const username = meta?.username || `user_${user.id.slice(0, 8)}`;
          const displayName = meta?.display_name || username;

          await adminClient
            .from('users')
            .insert({
              id: user.id,
              email: user.email,
              username: username.slice(0, 30).replace(/[^a-zA-Z0-9_]/g, '_'),
              display_name: displayName.slice(0, 50),
            });
        }
      }

      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
}
