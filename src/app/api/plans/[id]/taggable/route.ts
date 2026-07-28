// GET /api/plans/[id]/taggable — friends you may name in a comment who are not
// in this Moove yet.
//
// This is the read side of a deliberate, bounded amendment to wall 2 ("only for
// people who joined"). The bound: a tag can only ever name somebody WHO ALREADY
// HAS THIS MOOVE IN THEIR OWN FEED. Tagging therefore reveals nothing to anyone
// who could not already see it — it is a nudge toward a card they were already
// being shown, not a way to broadcast a private plan.
//
// The rule itself lives in `plan_taggable_friends`, in SQL, so this route and
// the write path in ../comments cannot drift apart. Being able to READ this
// list still requires being in the Moove: same `access` gate as the comments it
// feeds, because the picker is part of the compose box and nothing else.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { TaggableFriend } from '@/lib/comments'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  // Same gate as reading the thread: author, or holding a join for THIS plan.
  // plan_id is matched explicitly so a green join (plan_id IS NULL) is never
  // mistaken for membership of a Moove.
  const { data: plan } = await supabase
    .from('plans')
    .select('id, author_id, cancelled_at, expires_at')
    .eq('id', id)
    .maybeSingle()

  if (!plan || plan.cancelled_at || new Date(plan.expires_at) <= new Date()) {
    return NextResponse.json({ error: 'Not available' }, { status: 403 })
  }

  if (plan.author_id !== userId) {
    const { data: join } = await supabase
      .from('move_joins')
      .select('id')
      .eq('plan_id', id)
      .eq('joiner_id', userId)
      .maybeSingle()
    if (!join) return NextResponse.json({ error: 'Not available' }, { status: 403 })
  }

  const { data, error } = await supabase.rpc('plan_taggable_friends', {
    p_plan: id,
    p_viewer: userId,
  })

  if (error) {
    console.error('taggable friends failed:', error)
    // The picker degrades to roster-only rather than breaking the compose box.
    return NextResponse.json({ friends: [] })
  }

  const friends: TaggableFriend[] = (data ?? []).map(r => ({
    id: r.id,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
  }))

  return NextResponse.json({ friends })
}
