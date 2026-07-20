// GET /api/feed — green friends visible to the current user (visibility-filtered),
// each with their presence (joiners), plus the viewer's own move joiners.
// Uses the feed query from Section 13 of the PRD + Phase 9 presence (move_joins).

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

interface JoinerLite {
  id: string
  displayName: string | null
  avatarUrl: string | null
}

interface AnchoredMove {
  id: string
  title: string
  description: string
  brand: string | null
  category: string
  timeText: string | null
  linkUrl: string | null
}

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
    return NextResponse.json({ friends: [], myJoiners: [], ambient: { activeNow: 0, recentGreen: 0 } })
  }

  const friendIds = friendships.map(f => f.friend_id)

  // Ambient signals (10.1) — aggregate counts over the viewer's friends, never named.
  // active-now = friends in-app in the last 15 min; recent-green = friends green in the last 7 days.
  const nowMs = Date.now()
  const activeCutoff = new Date(nowMs - 15 * 60 * 1000).toISOString()
  const greenCutoff = new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: ambientRows } = await supabase
    .from('users')
    .select('last_active_at, last_green_at')
    .in('id', friendIds)
  const ambient = {
    activeNow: (ambientRows ?? []).filter(u => u.last_active_at !== null && u.last_active_at > activeCutoff).length,
    recentGreen: (ambientRows ?? []).filter(u => u.last_green_at !== null && u.last_green_at > greenCutoff).length,
  }

  // Get all green friends (visibility filtering happens next)
  const { data: greenFriends, error } = await supabase
    .from('users')
    .select('id, display_name, avatar_url, status_note, status_time, status_move_id, phone, status_set_at, visible_to')
    .in('id', friendIds)
    .eq('is_available', true)
    .order('status_set_at', { ascending: false, nullsFirst: false })

  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 })

  // Visibility filter — only friends whose visible_to includes one of my groups (or is null).
  const { data: memberOf } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)
  const myGroupIds = new Set((memberOf ?? []).map(m => m.group_id))

  const visibleFriends = (greenFriends ?? []).filter(f => {
    if (!f.visible_to) return true // null = everyone
    return (f.visible_to as string[]).some(gid => myGroupIds.has(gid))
  })

  // Anchored sponsored moves (13.8) — resolve the move each green friend brought over.
  const anchorIds = [
    ...new Set(visibleFriends.map(f => f.status_move_id).filter((v): v is string => !!v)),
  ]
  const anchorMap = new Map<string, AnchoredMove>()
  if (anchorIds.length > 0) {
    const { data: anchorRows } = await supabase
      .from('sponsored_moves')
      .select('id, title, description, brand, category, time_text, link_url')
      .in('id', anchorIds)
    for (const m of anchorRows ?? []) {
      anchorMap.set(m.id, {
        id: m.id,
        title: m.title,
        description: m.description,
        brand: m.brand,
        category: m.category,
        timeText: m.time_text,
        linkUrl: m.link_url,
      })
    }
  }

  // Presence (9.2): joins on the visible green friends' moves + on the viewer's own move.
  const moverIds = [...visibleFriends.map(f => f.id), userId]
  const { data: joins } = await supabase
    .from('move_joins')
    .select('mover_id, joiner_id')
    .in('mover_id', moverIds)

  const joinRows = joins ?? []

  // Resolve joiner display info — joiners are visible to everyone, even non-friends of the viewer.
  const joinerIds = [...new Set(joinRows.map(j => j.joiner_id))]
  const joinerMap = new Map<
    string,
    { id: string; displayName: string | null; avatarUrl: string | null; phone: string }
  >()
  if (joinerIds.length > 0) {
    const { data: joinerUsers } = await supabase
      .from('users')
      .select('id, display_name, avatar_url, phone')
      .in('id', joinerIds)
    for (const u of joinerUsers ?? []) {
      joinerMap.set(u.id, { id: u.id, displayName: u.display_name, avatarUrl: u.avatar_url, phone: u.phone })
    }
  }

  const joinersByMover = new Map<string, string[]>()
  for (const j of joinRows) {
    const arr = joinersByMover.get(j.mover_id) ?? []
    arr.push(j.joiner_id)
    joinersByMover.set(j.mover_id, arr)
  }

  function joinersFor(moverId: string): JoinerLite[] {
    return (joinersByMover.get(moverId) ?? [])
      .map(id => joinerMap.get(id))
      .filter((u): u is NonNullable<typeof u> => !!u)
      .map(u => ({ id: u.id, displayName: u.displayName, avatarUrl: u.avatarUrl }))
  }

  const friends = visibleFriends.map(f => ({
    id: f.id,
    displayName: f.display_name,
    avatarUrl: f.avatar_url,
    statusNote: f.status_note,
    statusTime: f.status_time,
    phone: f.phone,
    statusSetAt: f.status_set_at,
    joiners: joinersFor(f.id),
    joinedByMe: (joinersByMover.get(f.id) ?? []).includes(userId),
    anchoredMove: f.status_move_id ? anchorMap.get(f.status_move_id) ?? null : null,
  }))

  // The viewer's own move joiners — include phone for the group-chat blast (9.3).
  const myJoiners = (joinersByMover.get(userId) ?? [])
    .map(id => joinerMap.get(id))
    .filter((u): u is NonNullable<typeof u> => !!u)
    .map(u => ({ id: u.id, displayName: u.displayName, avatarUrl: u.avatarUrl, phone: u.phone }))

  return NextResponse.json({ friends, myJoiners, ambient })
}
