// POST /api/groups/[id]/leave — a member leaves a group they don't own.
// Removes only the caller's group_members row. Friendships are untouched (you
// stay friends with everyone; you just leave the group). Owners can't leave —
// they delete the group instead.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const { data: group } = await supabase.from('groups').select('owner_id').eq('id', id).maybeSingle()
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (group.owner_id === userId) {
    return NextResponse.json({ error: "Owner can't leave; delete the group instead" }, { status: 400 })
  }

  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', id)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: 'Leave failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
