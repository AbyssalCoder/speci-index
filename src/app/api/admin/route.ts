import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';

async function requireAdmin(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
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

    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view') ?? 'overview';

    if (view === 'overview') {
      const [
        totalUsers,
        totalSpecies,
        totalSubmissions,
        pendingReports,
        pendingSubmissions,
        todaySubmissions,
        bannedUsers,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.species.count(),
        prisma.submission.count(),
        prisma.report.count({ where: { status: 'PENDING' } }),
        prisma.submission.count({ where: { status: 'PENDING' } }),
        prisma.submission.count({
          where: { createdAt: { gte: new Date(Date.now() - 86400000) } },
        }),
        prisma.user.count({ where: { isBanned: true } }),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          totalUsers,
          totalSpecies,
          totalSubmissions,
          pendingReports,
          pendingSubmissions,
          todaySubmissions,
          bannedUsers,
        },
      });
    }

    if (view === 'reports') {
      const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
      const status = searchParams.get('status') ?? 'PENDING';

      const reports = await prisma.report.findMany({
        where: { status: status as 'PENDING' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED' },
        include: {
          reporter: { select: { username: true, displayName: true } },
          reportedUser: { select: { username: true, displayName: true } },
          submission: { select: { id: true, imageUrl: true, aiSpeciesGuess: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * 20,
        take: 20,
      });

      return NextResponse.json({ success: true, data: reports });
    }

    if (view === 'flagged') {
      const submissions = await prisma.submission.findMany({
        where: { status: { in: ['FLAGGED', 'UNDER_REVIEW'] } },
        include: {
          user: { select: { username: true, displayName: true, trustScore: true } },
          species: { select: { commonName: true, scientificName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return NextResponse.json({ success: true, data: submissions });
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

    const body = await req.json();
    const { action } = body as { action: string };

    switch (action) {
      case 'ban_user': {
        const { userId, reason } = body;
        await prisma.user.update({
          where: { id: userId },
          data: { isBanned: true, banReason: reason },
        });
        return NextResponse.json({ success: true });
      }

      case 'unban_user': {
        const { userId } = body;
        await prisma.user.update({
          where: { id: userId },
          data: { isBanned: false, banReason: null },
        });
        return NextResponse.json({ success: true });
      }

      case 'resolve_report': {
        const { reportId, resolution, note } = body;
        await prisma.report.update({
          where: { id: reportId },
          data: {
            status: resolution,
            resolvedBy: user.id,
            resolvedNote: note,
            resolvedAt: new Date(),
          },
        });
        return NextResponse.json({ success: true });
      }

      case 'review_submission': {
        const { submissionId, verdict, note: reviewNote } = body;
        await prisma.submission.update({
          where: { id: submissionId },
          data: {
            status: verdict,
            reviewedBy: user.id,
            reviewNote,
          },
        });
        return NextResponse.json({ success: true });
      }

      case 'verify_species': {
        const { speciesId } = body;
        await prisma.species.update({
          where: { id: speciesId },
          data: { isVerified: true },
        });
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
