// PATCH  /api/groups/[id] — update name, emoji, or member list (full replacement)
// DELETE /api/groups/[id] — delete group (cascades to group_members)

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  // Verify ownership
  const { data: group } = await supabase
    .from('groups')
    .select('id, name, emoji, group_members(user_id)')
    .eq('id', id)
    .eq('owner_id', userId)
    .single()

  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json() as {
    name?: string
    emoji?: string
    memberIds?: string[]
  }

  type GroupUpdate = { name?: string; emoji?: string }
  const updates: GroupUpdate = {}
  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name || name.length > 40) return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
    updates.name = name
  }
  if (body.emoji !== undefined) updates.emoji = body.emoji

  if (Object.keys(updates).length > 0) {
    await supabase.from('groups').update(updates).eq('id', id)
  }

  // Replace member list if provided (may be empty — groups can grow via the link)
  if (body.memberIds !== undefined) {
    await supabase.from('group_members').delete().eq('group_id', id)
    if (body.memberIds.length > 0) {
      await supabase.from('group_members').insert(
        body.memberIds.map(uid => ({ group_id: id, user_id: uid }))
      )
    }
  }

  const { data: updated } = await supabase
    .from('groups')
    .select('id, name, emoji, group_members(user_id)')
    .eq('id', id)
    .single()

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    emoji: updated.emoji,
    memberCount: updated.group_members.length,
    memberIds: updated.group_members.map((m: { user_id: string }) => m.user_id),
  })
}

export async function DELETE(req: Request, { params }: Params) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('groups')
    .delete()
    .eq('id', id)
    .eq('owner_id', userId)

  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })

  return new Response(null, { status: 204 })
}
