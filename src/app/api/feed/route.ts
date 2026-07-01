// GET /api/feed — green friends visible to the current user (visibility-filtered)
// Uses the feed query from Section 13 of the PRD.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  // Get friend IDs
  const { data: friendships } = await supabase
    .from('friendships')
    .select('friend_id')
    .eq('user_id', userId)

  if (!friendships || friendships.length === 0) {
    return NextResponse.json({ friends: [] })
  }

  const friendIds = friendships.map(f => f.friend_id)

  // Get all green friends (visibility filtering happens next)
  const { data: greenFriends, error } = await supabase
    .from('users')
    .select('id, display_name, avatar_url, status_note, phone, status_set_at, visible_to')
    .in('id', friendIds)
    .eq('is_available', true)
    .order('status_set_at', { ascending: false, nullsFirst: false })

  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  if (!greenFriends || greenFriends.length === 0) return NextResponse.json({ friends: [] })

  // For friends with visible_to set, check if current user is in any of those groups
  // Get all groups where the current user is a member
  const { data: memberOf } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)

  const myGroupIds = new Set((memberOf ?? []).map(m => m.group_id))

  const visible = greenFriends.filter(f => {
    if (!f.visible_to) return true  // null = everyone
    // visible_to is an array of group IDs owned by the green user
    return (f.visible_to as string[]).some(gid => myGroupIds.has(gid))
  })

  return NextResponse.json({
    friends: visible.map(f => ({
      id: f.id,
      displayName: f.display_name,
      avatarUrl: f.avatar_url,
      statusNote: f.status_note,
      phone: f.phone,
      statusSetAt: f.status_set_at,
    })),
  })
}
