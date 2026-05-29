import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

const friendRequestSchema = z.object({
  receiverId: z.string().uuid(),
});

// Send friend request
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const parsed = friendRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    if (parsed.data.receiverId === user.id) {
      return NextResponse.json({ success: false, error: 'Cannot send request to yourself' }, { status: 400 });
    }

    const admin = getAdminClient();

    // Check if already friends
    const { data: existingFriendship } = await admin
      .from('friendships')
      .select('id')
      .or(`and(userAId.eq.${user.id},userBId.eq.${parsed.data.receiverId}),and(userAId.eq.${parsed.data.receiverId},userBId.eq.${user.id})`)
      .maybeSingle();

    if (existingFriendship) {
      return NextResponse.json({ success: false, error: 'Already friends' }, { status: 409 });
    }

    // Check for existing pending request
    const { data: existing } = await admin
      .from('friend_requests')
      .select('id')
      .eq('status', 'PENDING')
      .or(`and(senderId.eq.${user.id},receiverId.eq.${parsed.data.receiverId}),and(senderId.eq.${parsed.data.receiverId},receiverId.eq.${user.id})`)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: false, error: 'Request already pending' }, { status: 409 });
    }

    const { data: request, error: reqError } = await admin
      .from('friend_requests')
      .insert({ senderId: user.id, receiverId: parsed.data.receiverId, updatedAt: new Date().toISOString() })
      .select()
      .single();

    if (reqError) throw reqError;

    // Create notification
    await admin
      .from('notifications')
      .insert({
        userId: parsed.data.receiverId,
        type: 'FRIEND_REQUEST',
        title: 'New Friend Request',
        body: 'You received a friend request',
        data: { requestId: request.id, senderId: user.id },
      });

    return NextResponse.json({ success: true, data: request });
  } catch (error) {
    console.error('Friend request error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// Get friends list
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const admin = getAdminClient();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') ?? 'friends';

    if (type === 'requests') {
      const { data: requests, error } = await admin
        .from('friend_requests')
        .select('*, sender:users!senderId(id, username, displayName, avatarUrl, totalPoints)')
        .eq('receiverId', user.id)
        .eq('status', 'PENDING')
        .order('createdAt', { ascending: false });

      if (error) throw error;
      return NextResponse.json({ success: true, data: requests ?? [] });
    }

    const { data: friendships, error } = await admin
      .from('friendships')
      .select('*, userA:users!userAId(id, username, displayName, avatarUrl, totalPoints, speciesCount), userB:users!userBId(id, username, displayName, avatarUrl, totalPoints, speciesCount)')
      .or(`userAId.eq.${user.id},userBId.eq.${user.id}`);

    if (error) throw error;

    const friends = (friendships ?? []).map((f: Record<string, any>) =>
      f.userAId === user.id ? f.userB : f.userA
    );

    return NextResponse.json({ success: true, data: friends });
  } catch (error) {
    console.error('Friends error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// Accept/reject friend request
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { requestId, action } = body as { requestId: string; action: 'accept' | 'reject' };

    const admin = getAdminClient();

    const { data: request } = await admin
      .from('friend_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();

    if (!request || request.receiverId !== user.id || request.status !== 'PENDING') {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }

    if (action === 'accept') {
      await admin
        .from('friend_requests')
        .update({ status: 'ACCEPTED', updatedAt: new Date().toISOString() })
        .eq('id', requestId);

      await admin
        .from('friendships')
        .insert({
          userAId: request.senderId,
          userBId: request.receiverId,
        });
    } else {
      await admin
        .from('friend_requests')
        .update({ status: 'REJECTED', updatedAt: new Date().toISOString() })
        .eq('id', requestId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Friend action error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
