import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
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

    // Check if already friends
    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userAId: user.id, userBId: parsed.data.receiverId },
          { userAId: parsed.data.receiverId, userBId: user.id },
        ],
      },
    });
    if (existingFriendship) {
      return NextResponse.json({ success: false, error: 'Already friends' }, { status: 409 });
    }

    // Check for existing pending request
    const existing = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: user.id, receiverId: parsed.data.receiverId, status: 'PENDING' },
          { senderId: parsed.data.receiverId, receiverId: user.id, status: 'PENDING' },
        ],
      },
    });
    if (existing) {
      return NextResponse.json({ success: false, error: 'Request already pending' }, { status: 409 });
    }

    const request = await prisma.friendRequest.create({
      data: { senderId: user.id, receiverId: parsed.data.receiverId },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: parsed.data.receiverId,
        type: 'FRIEND_REQUEST',
        title: 'New Friend Request',
        body: `You received a friend request`,
        data: { requestId: request.id, senderId: user.id },
      },
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

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') ?? 'friends';

    if (type === 'requests') {
      const requests = await prisma.friendRequest.findMany({
        where: { receiverId: user.id, status: 'PENDING' },
        include: {
          sender: {
            select: { id: true, username: true, displayName: true, avatarUrl: true, totalPoints: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ success: true, data: requests });
    }

    const friendships = await prisma.friendship.findMany({
      where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
      include: {
        userA: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, totalPoints: true, speciesCount: true },
        },
        userB: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, totalPoints: true, speciesCount: true },
        },
      },
    });

    const friends = friendships.map((f) =>
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

    const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!request || request.receiverId !== user.id || request.status !== 'PENDING') {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }

    if (action === 'accept') {
      await prisma.$transaction([
        prisma.friendRequest.update({
          where: { id: requestId },
          data: { status: 'ACCEPTED' },
        }),
        prisma.friendship.create({
          data: {
            userAId: request.senderId,
            userBId: request.receiverId,
          },
        }),
      ]);
    } else {
      await prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: 'REJECTED' },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Friend action error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
