import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const reportSchema = z.object({
  submissionId: z.string().uuid().optional(),
  reportedUserId: z.string().uuid().optional(),
  reason: z.enum(['FAKE_IMAGE', 'WRONG_SPECIES', 'INAPPROPRIATE', 'CHEATING', 'SPAM', 'GPS_SPOOF', 'OTHER']),
  description: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const parsed = reportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    const report = await prisma.report.create({
      data: {
        reporterId: user.id,
        ...parsed.data,
      },
    });

    return NextResponse.json({ success: true, data: { id: report.id } });
  } catch (error) {
    console.error('Report error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
