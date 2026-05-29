import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unread') === 'true';
    const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20'));

    const admin = getAdminClient();

    let query = admin
      .from('notifications')
      .select('*')
      .eq('userId', user.id)
      .order('createdAt', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq('isRead', false);
    }

    const [notifResult, countResult] = await Promise.all([
      query,
      admin
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('userId', user.id)
        .eq('isRead', false),
    ]);

    if (notifResult.error) throw notifResult.error;
    if (countResult.error) throw countResult.error;

    return NextResponse.json({
      success: true,
      data: { notifications: notifResult.data ?? [], unreadCount: countResult.count ?? 0 },
    });
  } catch (error) {
    console.error('Notifications error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// Mark as read
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { notificationIds, markAll } = body as {
      notificationIds?: string[];
      markAll?: boolean;
    };

    const admin = getAdminClient();

    if (markAll) {
      const { error } = await admin
        .from('notifications')
        .update({ isRead: true })
        .eq('userId', user.id)
        .eq('isRead', false);

      if (error) throw error;
    } else if (notificationIds?.length) {
      const { error } = await admin
        .from('notifications')
        .update({ isRead: true })
        .in('id', notificationIds)
        .eq('userId', user.id);

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notification update error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
