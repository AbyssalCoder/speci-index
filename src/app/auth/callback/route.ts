import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirect = searchParams.get('redirect') || '/dashboard';

  if (code) {
    const response = NextResponse.redirect(`${origin}${redirect}`);

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

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if user has a profile, create one if not (via REST API)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const adminClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const { data: existingProfile } = await adminClient
          .from('users')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();

        if (!existingProfile) {
          const meta = user.user_metadata;
          const username = meta?.username || meta?.preferred_username || meta?.name?.replace(/\s+/g, '_').toLowerCase() || `user_${user.id.slice(0, 8)}`;
          const displayName = meta?.display_name || meta?.full_name || meta?.name || username;

          const cleanUsername = username.slice(0, 30).replace(/[^a-zA-Z0-9_]/g, '_');

          const { error: insertError } = await adminClient
            .from('users')
            .insert({
              id: user.id,
              email: user.email,
              username: cleanUsername,
              displayName: displayName.slice(0, 50),
              avatarUrl: meta?.avatar_url || null,
              updatedAt: new Date().toISOString(),
            });

          if (insertError) {
            // Username conflict — try with fallback
            const fallbackUsername = `user_${user.id.slice(0, 8)}`;
            await adminClient
              .from('users')
              .insert({
                id: user.id,
                email: user.email,
                username: fallbackUsername,
                displayName: displayName.slice(0, 50),
                avatarUrl: meta?.avatar_url || null,
                updatedAt: new Date().toISOString(),
              });
          }
        }
      }

      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
