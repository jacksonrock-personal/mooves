// POST   /api/moves/join — join a friend's active green ("I'm in")
// DELETE /api/moves/join — leave it (toggle off)
//
// A join links the current user (joiner) to a mover's active green session.
// Joining does NOT change the joiner's own availability. Joins are cleared when
// the mover goes grey (see /api/status).
//
// Phase 20: move_joins also carries PLAN joins now, discriminated by plan_id.
// Every query here filters `plan_id IS NULL` so green joins and plan joins never
// bleed into each other — a plan join stores the plan's author in mover_id, so
// an unfiltered query on this table would pick them up.

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

  // Idempotent. This was an upsert on the old composite primary key; uniqueness
  // now lives in a PARTIAL index (`WHERE plan_id IS NULL`), which supabase-js
  // cannot express in onConflict — Postgres needs the predicate to infer it. So
  // check first, then insert.
  const { data: existing } = await supabase
    .from('move_joins')
    .select('id')
    .eq('mover_id', moverId)
    .eq('joiner_id', userId)
    .is('plan_id', null)
    .maybeSingle()

  if (existing) return NextResponse.json({ joined: true })

  const { error } = await supabase
    .from('move_joins')
    .insert({ mover_id: moverId, joiner_id: userId, plan_id: null })

  // 23505 = someone else's request won the race; the end state is what we wanted.
  if (error && error.code !== '23505') {
    return NextResponse.json({ error: 'Join failed' }, { status: 500 })
  }
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
    .is('plan_id', null)

  if (error) return NextResponse.json({ error: 'Leave failed' }, { status: 500 })
  return NextResponse.json({ joined: false })
}
