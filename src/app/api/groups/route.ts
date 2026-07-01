// GET  /api/groups — current user's groups with member counts + member IDs
// POST /api/groups — create a new group

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: groups, error } = await supabase
    .from('groups')
    .select('id, name, emoji, created_at, group_members(user_id)')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 })

  return NextResponse.json({
    groups: (groups ?? []).map(g => ({
      id: g.id,
      name: g.name,
      emoji: g.emoji,
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
  if (!body.memberIds || body.memberIds.length === 0) {
    return NextResponse.json({ error: 'At least one member required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({ owner_id: userId, name, emoji: body.emoji })
    .select('id')
    .single()

  if (groupError || !group) {
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 })
  }

  const memberRows = body.memberIds.map(uid => ({ group_id: group.id, user_id: uid }))
  const { error: memberError } = await supabase.from('group_members').insert(memberRows)

  if (memberError) {
    await supabase.from('groups').delete().eq('id', group.id)
    return NextResponse.json({ error: 'Failed to add members' }, { status: 500 })
  }

  return NextResponse.json(
    { id: group.id, name, emoji: body.emoji, memberCount: body.memberIds.length, memberIds: body.memberIds },
    { status: 201 }
  )
}
