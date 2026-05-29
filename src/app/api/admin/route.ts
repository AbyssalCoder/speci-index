import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

async function requireAdmin(userId: string) {
  const admin = getAdminClient();
  const { data: user } = await admin
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  return user?.role === 'ADMIN' || user?.role === 'MODERATOR';
}

// GET admin stats
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const isAdmin = await requireAdmin(user.id);
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const admin = getAdminClient();
    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view') ?? 'overview';

    if (view === 'overview') {
      const [
        { count: totalUsers },
        { count: totalSpecies },
        { count: totalSubmissions },
        { count: pendingReports },
        { count: pendingSubmissions },
        { count: todaySubmissions },
        { count: bannedUsers },
      ] = await Promise.all([
        admin.from('users').select('id', { count: 'exact', head: true }),
        admin.from('species').select('id', { count: 'exact', head: true }),
        admin.from('submissions').select('id', { count: 'exact', head: true }),
        admin.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
        admin.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
        admin.from('submissions').select('id', { count: 'exact', head: true }).gte('createdAt', new Date(Date.now() - 86400000).toISOString()),
        admin.from('users').select('id', { count: 'exact', head: true }).eq('isBanned', true),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          totalUsers: totalUsers ?? 0,
          totalSpecies: totalSpecies ?? 0,
          totalSubmissions: totalSubmissions ?? 0,
          pendingReports: pendingReports ?? 0,
          pendingSubmissions: pendingSubmissions ?? 0,
          todaySubmissions: todaySubmissions ?? 0,
          bannedUsers: bannedUsers ?? 0,
        },
      });
    }

    if (view === 'reports') {
      const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
      const status = searchParams.get('status') ?? 'PENDING';

      const { data: reports, error } = await admin
        .from('reports')
        .select('*, reporter:users!reporterId(username, displayName), reportedUser:users!reportedUserId(username, displayName), submission:submissions!submissionId(id, imageUrl, aiSpeciesGuess)')
        .eq('status', status)
        .order('createdAt', { ascending: false })
        .range((page - 1) * 20, page * 20 - 1);

      if (error) throw error;
      return NextResponse.json({ success: true, data: reports ?? [] });
    }

    if (view === 'flagged') {
      const { data: submissions, error } = await admin
        .from('submissions')
        .select('*, user:users!userId(username, displayName, trustScore), species:species!speciesId(commonName, scientificName)')
        .in('status', ['FLAGGED', 'UNDER_REVIEW'])
        .order('createdAt', { ascending: false })
        .limit(50);

      if (error) throw error;
      return NextResponse.json({ success: true, data: submissions ?? [] });
    }

    return NextResponse.json({ success: false, error: 'Invalid view' }, { status: 400 });
  } catch (error) {
    console.error('Admin error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// Admin actions (ban, resolve reports, etc.)
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const isAdmin = await requireAdmin(user.id);
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const admin = getAdminClient();
    const body = await req.json();
    const { action } = body as { action: string };

    switch (action) {
      case 'ban_user': {
        const { userId, reason } = body;
        await admin.from('users').update({ isBanned: true, banReason: reason, updatedAt: new Date().toISOString() }).eq('id', userId);
        return NextResponse.json({ success: true });
      }

      case 'unban_user': {
        const { userId } = body;
        await admin.from('users').update({ isBanned: false, banReason: null, updatedAt: new Date().toISOString() }).eq('id', userId);
        return NextResponse.json({ success: true });
      }

      case 'resolve_report': {
        const { reportId, resolution, note } = body;
        await admin.from('reports').update({
          status: resolution,
          resolvedBy: user.id,
          resolvedNote: note,
          resolvedAt: new Date().toISOString(),
        }).eq('id', reportId);
        return NextResponse.json({ success: true });
      }

      case 'review_submission': {
        const { submissionId, verdict, note: reviewNote } = body;
        await admin.from('submissions').update({
          status: verdict,
          reviewedBy: user.id,
          reviewNote,
          updatedAt: new Date().toISOString(),
        }).eq('id', submissionId);
        return NextResponse.json({ success: true });
      }

      case 'verify_species': {
        const { speciesId } = body;
        await admin.from('species').update({ isVerified: true, updatedAt: new Date().toISOString() }).eq('id', speciesId);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Admin action error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
