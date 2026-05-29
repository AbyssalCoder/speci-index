import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { prisma } from '@/lib/db';

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
      // Check if user has a profile, create one if not
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const existingProfile = await prisma.user.findUnique({ where: { id: user.id } });
        if (!existingProfile) {
          // Try to create profile from user metadata (set during signup)
          const meta = user.user_metadata;
          const username = meta?.username || meta?.preferred_username || meta?.name?.replace(/\s+/g, '_').toLowerCase() || `user_${user.id.slice(0, 8)}`;
          const displayName = meta?.display_name || meta?.full_name || meta?.name || username;

          try {
            await prisma.user.create({
              data: {
                id: user.id,
                email: user.email!,
                username: username.slice(0, 30).replace(/[^a-zA-Z0-9_]/g, '_'),
                displayName: displayName.slice(0, 50),
                avatarUrl: meta?.avatar_url || null,
              },
            });
          } catch (e) {
            // If username conflict, add random suffix
            const fallbackUsername = `user_${user.id.slice(0, 8)}`;
            try {
              await prisma.user.create({
                data: {
                  id: user.id,
                  email: user.email!,
                  username: fallbackUsername,
                  displayName: displayName.slice(0, 50),
                  avatarUrl: meta?.avatar_url || null,
                },
              });
            } catch {
              // Profile creation failed — user will see 404 on profile fetch
              console.error('Failed to create profile:', e);
            }
          }
        }
      }

      return response;
    }
  }

  // If code exchange failed or no code, redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
