// Phase 20.3
// POST   /api/plans/[id]/join — "I'm in" on a planned Moove
// DELETE /api/plans/[id]/join — drop off it
//
// Plan joins share the move_joins table with green joins, discriminated by
// plan_id. mover_id holds the PLAN'S AUTHOR, which is what lets one Joiners
// component, one blast path and one realtime subscription serve both objects —
// and also why every green-side query must filter `plan_id IS NULL`.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { markActivated } from '@/lib/activation'

async function loadJoinablePlan(
  supabase: ReturnType<typeof createServiceClient>,
  planId: string,
  userId: string,
) {
  const { data: plan } = await supabase
    .from('plans')
    .select('id, author_id, cancelled_at, expires_at, visible_to, visible_user_ids')
    .eq('id', planId)
    .maybeSingle()

  if (!plan) return { error: 'notfound' as const }
  if (plan.cancelled_at) return { error: 'gone' as const }
  if (new Date(plan.expires_at) <= new Date()) return { error: 'gone' as const }
  if (plan.author_id === userId) return { error: 'own' as const }

  // Same gate as the feed: you must be friends with the author, and a
  // group-scoped Moove needs a shared group. viewer_group_ids is used so an
  // owner counts as a member of their own group.
  const [{ data: friendship }, { data: myGroups }] = await Promise.all([
    supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', userId)
      .eq('friend_id', plan.author_id)
      .maybeSingle(),
    supabase.rpc('viewer_group_ids', { p_user: userId }),
  ])

  if (!friendship) return { error: 'forbidden' as const }

  // R27 fix: this used to check visible_to ALONE, which left a hole exactly the
  // size of R16's feature. A Moove scoped only to named individuals has
  // visible_to = NULL, so the group branch was skipped and the whole audience
  // check fell through — any friend of the author could join a Moove they were
  // never shown, by calling this route directly.
  //
  // The predicate now mirrors get_plans: unscoped means NEITHER array was set,
  // and a scoped Moove admits you via a shared group OR by name.
  const groupScoped = (plan.visible_to?.length ?? 0) > 0
  const userScoped = (plan.visible_user_ids?.length ?? 0) > 0

  if (groupScoped || userScoped) {
    const mine = new Set(((myGroups as { group_id: string }[]) ?? []).map(g => g.group_id))
    const viaGroup = plan.visible_to?.some(g => mine.has(g)) ?? false
    const viaName = plan.visible_user_ids?.includes(userId) ?? false
    if (!viaGroup && !viaName) return { error: 'forbidden' as const }
  }

  return { plan }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()
  const gate = await loadJoinablePlan(supabase, id, userId)
  if ('error' in gate) {
    const status = gate.error === 'forbidden' || gate.error === 'own' ? 403 : 404
    return NextResponse.json({ error: 'Cannot join that' }, { status })
  }

  // Idempotent. Uniqueness is a PARTIAL index (`WHERE plan_id IS NOT NULL`),
  // which supabase-js cannot express via onConflict, so check then insert.
  const { data: existing } = await supabase
    .from('move_joins')
    .select('id')
    .eq('plan_id', id)
    .eq('joiner_id', userId)
    .maybeSingle()

  if (existing) return NextResponse.json({ joined: true })

  const { error } = await supabase
    .from('move_joins')
    .insert({ mover_id: gate.plan.author_id, joiner_id: userId, plan_id: id })

  if (error && error.code !== '23505') {
    console.error('plan join failed:', error)
    return NextResponse.json({ error: 'Join failed' }, { status: 500 })
  }

  // 24.4 — the reciprocal event. Both sides activate: the joiner did something
  // with a friend, the author had something land. Fire-and-forget, because
  // failing to record activation must never fail the join that caused it.
  void markActivated(supabase, [userId, gate.plan.author_id])

  return NextResponse.json({ joined: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('move_joins')
    .delete()
    .eq('plan_id', id)
    .eq('joiner_id', userId)

  if (error) return NextResponse.json({ error: 'Leave failed' }, { status: 500 })
  return NextResponse.json({ joined: false })
}
