// POST /api/group-invite/[code]/join — auth required.
// Phase 10.2: join the group behind the link AND auto-friend the owner + all
// current members (mutual). Idempotent; returns already_member if applicable.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await params
  const supabase = createServiceClient()

  const { data: group } = await supabase
    .from('groups')
    .select('id, name, owner_id, group_members(user_id)')
    .eq('invite_code', code)
    .maybeSingle()

  if (!group) return NextResponse.json({ status: 'invalid' }, { status: 404 })

  const memberIds = group.group_members.map(m => m.user_id)
  const alreadyMember = group.owner_id === userId || memberIds.includes(userId)
  if (alreadyMember) {
    return NextResponse.json({ status: 'already_member', name: group.name })
  }

  // Everyone the joiner will connect with: owner + members, minus themselves.
  const connectIds = [...new Set([group.owner_id, ...memberIds])].filter(id => id !== userId)

  // Add the joiner to the group (idempotent).
  const { error: memberError } = await supabase
    .from('group_members')
    .upsert({ group_id: group.id, user_id: userId }, { onConflict: 'group_id,user_id' })
  if (memberError) return NextResponse.json({ error: 'Join failed' }, { status: 500 })

  // Auto-friend all of them (mutual). Ignore rows that already exist.
  if (connectIds.length > 0) {
    const rows = connectIds.flatMap(other => [
      { user_id: userId, friend_id: other },
      { user_id: other, friend_id: userId },
    ])
    const { error: friendError } = await supabase
      .from('friendships')
      .upsert(rows, { onConflict: 'user_id,friend_id', ignoreDuplicates: true })
    if (friendError) return NextResponse.json({ error: 'Join failed' }, { status: 500 })
  }

  return NextResponse.json({ status: 'joined', name: group.name, connectedCount: connectIds.length })
}
