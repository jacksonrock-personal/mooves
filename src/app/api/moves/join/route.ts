// POST   /api/moves/join — join a friend's active move ("I'm in")
// DELETE /api/moves/join — leave it (toggle off)
//
// A join links the current user (joiner) to a mover's active green session.
// Joining does NOT change the joiner's own availability. Joins are cleared when
// the mover goes grey (see /api/status).

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { moverId?: string }
  const moverId = body.moverId
  if (!moverId) return NextResponse.json({ error: 'moverId is required' }, { status: 400 })
  if (moverId === userId) return NextResponse.json({ error: "Can't join your own move" }, { status: 400 })

  const supabase = createServiceClient()

  // The joiner must be friends with the mover, and the mover must be green.
  const [{ data: friendship }, { data: mover }] = await Promise.all([
    supabase.from('friendships').select('friend_id').eq('user_id', userId).eq('friend_id', moverId).maybeSingle(),
    supabase.from('users').select('is_available').eq('id', moverId).maybeSingle(),
  ])

  if (!friendship) return NextResponse.json({ error: 'Not friends' }, { status: 403 })
  if (!mover?.is_available) return NextResponse.json({ error: 'Move is no longer active' }, { status: 409 })

  // Idempotent: re-joining is a no-op (PK is mover_id + joiner_id).
  const { error } = await supabase
    .from('move_joins')
    .upsert({ mover_id: moverId, joiner_id: userId }, { onConflict: 'mover_id,joiner_id' })

  if (error) return NextResponse.json({ error: 'Join failed' }, { status: 500 })
  return NextResponse.json({ joined: true })
}

export async function DELETE(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { moverId?: string }
  const moverId = body.moverId
  if (!moverId) return NextResponse.json({ error: 'moverId is required' }, { status: 400 })

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('move_joins')
    .delete()
    .eq('mover_id', moverId)
    .eq('joiner_id', userId)

  if (error) return NextResponse.json({ error: 'Leave failed' }, { status: 500 })
  return NextResponse.json({ joined: false })
}
