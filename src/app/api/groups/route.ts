// GET  /api/groups — current user's groups with member counts + member IDs
// POST /api/groups — create a new group

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  // Groups the user OWNS or is a MEMBER of — Phase 10 invite links make you a
  // member of groups you didn't create, and those must show in your list too.
  const { data: memberships } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)
  const memberGroupIds = (memberships ?? []).map(m => m.group_id)

  const base = supabase
    .from('groups')
    .select('id, name, emoji, owner_id, created_at, group_members(user_id)')
  const filtered =
    memberGroupIds.length > 0
      ? base.or(`owner_id.eq.${userId},id.in.(${memberGroupIds.join(',')})`)
      : base.eq('owner_id', userId)

  const { data: groups, error } = await filtered.order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 })

  return NextResponse.json({
    groups: (groups ?? []).map(g => ({
      id: g.id,
      name: g.name,
      emoji: g.emoji,
      ownerId: g.owner_id,
      isOwner: g.owner_id === userId,
      memberCount: g.group_members.length,
      memberIds: g.group_members.map((m: { user_id: string }) => m.user_id),
    })),
  })
}

export async function POST(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    name?: string
    emoji?: string
    memberIds?: string[]
  }

  const name = body.name?.trim() ?? ''
  if (!name || name.length > 40) {
    return NextResponse.json({ error: 'Name required (max 40 chars)' }, { status: 400 })
  }
  if (!body.emoji) {
    return NextResponse.json({ error: 'emoji required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Members are OPTIONAL — a group can start empty and grow via its invite link
  // (Phase 10). Any members you do add up front must be mutual friends.
  const memberIds = Array.from(new Set(body.memberIds ?? []))
  if (memberIds.length > 0) {
    const { data: friendRows } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', userId)
      .in('friend_id', memberIds)
    const friendSet = new Set((friendRows ?? []).map(f => f.friend_id))
    if (memberIds.some(id => !friendSet.has(id))) {
      return NextResponse.json({ error: 'Members must be your friends' }, { status: 400 })
    }
  }

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({ owner_id: userId, name, emoji: body.emoji })
    .select('id')
    .single()

  if (groupError || !group) {
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 })
  }

  if (memberIds.length > 0) {
    const memberRows = memberIds.map(uid => ({ group_id: group.id, user_id: uid }))
    const { error: memberError } = await supabase.from('group_members').insert(memberRows)
    if (memberError) {
      await supabase.from('groups').delete().eq('id', group.id)
      return NextResponse.json({ error: 'Failed to add members' }, { status: 500 })
    }
  }

  return NextResponse.json(
    { id: group.id, name, emoji: body.emoji, memberCount: memberIds.length, memberIds },
    { status: 201 }
  )
}
