// GET /api/friends/[friendId]/week — R25, one friend's availability week.
//
// The ONLY read path for somebody else's slots. availability_slots has RLS on
// and no policies, so this route cannot reach the rows itself: it calls
// get_friend_week(), which carries the friendship check and the scope predicate
// in the same query as the data. That is deliberate — a route that could
// SELECT the table directly is a route that can forget the predicate.
//
// A viewer who may not see this week gets 404, not 403 and not an empty week.
// "He has nothing on", "you are not allowed to know" and "no such person" are
// three different answers, and only the first is anybody else's business.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { isSlotPart, type SlotPart } from '@/lib/availability'

export interface FriendWeek {
  id: string
  displayName: string | null
  avatarUrl: string | null
  phone: string | null
  /** 'YYYY-MM-DD', the target's own week, derived from THEIR ritual day. */
  weekStart: string
  weekEnd: string
  /** Live green, already filtered by the green's own scope — not the week's. */
  isGreen: boolean
  statusTime: string | null
  statusExpiresAt: string | null
  slots: { date: string; part: SlotPart }[]
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ friendId: string }> }
) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { friendId } = await params

  // Your own week has its own route (/api/availability) that can also write it.
  // Sending people here for themselves would give the same data two shapes.
  if (friendId === userId) {
    return NextResponse.json({ error: 'Use /api/availability' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('get_friend_week', {
    viewer: userId,
    target: friendId,
  })

  if (error) {
    console.error('get_friend_week error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }

  // NULL is the function's way of saying "not allowed, or no such user".
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const raw = data as Record<string, unknown>
  const slots = Array.isArray(raw.slots) ? raw.slots : []

  const week: FriendWeek = {
    id: String(raw.id),
    displayName: (raw.displayName as string | null) ?? null,
    avatarUrl: (raw.avatarUrl as string | null) ?? null,
    phone: (raw.phone as string | null) ?? null,
    weekStart: String(raw.weekStart),
    weekEnd: String(raw.weekEnd),
    isGreen: raw.isGreen === true,
    statusTime: (raw.statusTime as string | null) ?? null,
    statusExpiresAt: (raw.statusExpiresAt as string | null) ?? null,
    // The check is not paranoia: `part` is a CHECK constraint in Postgres, not
    // a TS union, and the grid indexes by it.
    slots: (slots as { date: string; part: string }[])
      .filter(s => isSlotPart(s.part))
      .map(s => ({ date: s.date, part: s.part as SlotPart })),
  }

  return NextResponse.json(week)
}
