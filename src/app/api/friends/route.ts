// GET /api/friends — all mutual friends (for People screen)
//
// R25 adds weekCount, the number behind "4 this week" on each row. It comes
// from friend_week_counts(), NOT from a count on availability_slots, because
// the count is SCOPED: a friend whose week is scoped away from you is absent
// from that function's result entirely, and two people looking at the same
// friend can honestly see different numbers. Counting rows here would leak the
// existence of slots the viewer is not entitled to — the same class of bug as a
// scoped green reaching the wrong rail.
//
// A friend missing from the counts map is `null`, not 0. Both render as no
// chip, but only one of them is a fact about the friend, and the client should
// not have to guess which one it is holding.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const [friendsRes, countsRes] = await Promise.all([
    supabase
      .from('friendships')
      .select('friend_id, users!friend_id(id, display_name, avatar_url)')
      .eq('user_id', userId)
      .order('display_name', { referencedTable: 'users', ascending: true }),
    supabase.rpc('friend_week_counts', { viewer: userId }),
  ])

  if (friendsRes.error) return NextResponse.json({ error: 'Query failed' }, { status: 500 })

  // The list is the feature; the chip is decoration on it. A counts query that
  // fails drops the chips and leaves the screen working, rather than 500-ing
  // the People tab over a number.
  if (countsRes.error) console.error('friend_week_counts error:', countsRes.error)

  const countByFriend = new Map<string, number>(
    (countsRes.data ?? []).map(c => [c.friend_id, c.slot_count]),
  )

  const friends = (friendsRes.data ?? []).map(f => {
    const u = f.users as { id: string; display_name: string | null; avatar_url: string | null } | null
    const id = u?.id ?? f.friend_id
    return {
      id,
      displayName: u?.display_name ?? null,
      avatarUrl: u?.avatar_url ?? null,
      weekCount: countByFriend.has(id) ? (countByFriend.get(id) as number) : null,
    }
  })

  return NextResponse.json({ friends })
}
