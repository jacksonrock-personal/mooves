// R8 — like / unlike a comment.
//
// POST   = like
// DELETE = unlike
//
// This amends Phase 21, which said "no reactions on comments" — deliberately and
// narrowly, with the reasoning written into the spec rather than left implicit.
// What still holds:
//
//   • the access gate is the SAME one comments use, so a like is only ever
//     visible to, or castable by, someone the Moove was shared with (wall 3);
//     R28 widened that from "joined" to "can see it" on both sides at once —
//     had only the comment route moved, everyone newly able to comment would
//     have found a heart that silently 403s;
//   • the count is returned here and rendered beside its heart, and nowhere
//     else — not on the card, not on the tab;
//   • no push, ever. Nobody is told they were liked.
//
// You may like your own comment. Blocking it is a fiddly rule guarding nothing.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit, tooManyRequests } from '@/lib/ratelimit'
import { canSeePlan } from '@/lib/visibility'

type Supabase = ReturnType<typeof createServiceClient>

/**
 * Same gate as commenting, plus a check that the comment belongs to this Moove
 * — so a valid comment id from another plan cannot be liked through a plan the
 * caller happens to be in.
 */
async function gate(
  supabase: Supabase,
  planId: string,
  commentId: string,
  userId: string,
): Promise<boolean> {
  const { data: plan } = await supabase
    .from('plans')
    .select('author_id, cancelled_at, expires_at, visible_to, visible_user_ids')
    .eq('id', planId)
    .maybeSingle()

  if (!plan) return false
  if (plan.cancelled_at) return false
  if (new Date(plan.expires_at) <= new Date()) return false

  const { data: comment } = await supabase
    .from('plan_comments')
    .select('id')
    .eq('id', commentId)
    .eq('plan_id', planId)
    .maybeSingle()
  if (!comment) return false

  return canSeePlan(supabase, plan, userId)
}

async function countFor(supabase: Supabase, commentId: string): Promise<number> {
  const { count } = await supabase
    .from('plan_comment_likes')
    .select('comment_id', { count: 'exact', head: true })
    .eq('comment_id', commentId)
  return count ?? 0
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, commentId } = await params

  // A floor against a stuck client, not an engagement throttle.
  if (!(await checkRateLimit(`comments:like:${userId}`, 240, 3600))) return tooManyRequests()

  const supabase = createServiceClient()
  if (!(await gate(supabase, id, commentId, userId))) {
    return NextResponse.json({ error: 'Not available' }, { status: 403 })
  }

  // The composite PK makes a double-tap idempotent rather than a duplicate.
  const { error } = await supabase
    .from('plan_comment_likes')
    .upsert({ comment_id: commentId, user_id: userId }, { onConflict: 'comment_id,user_id' })

  if (error) {
    console.error('like failed:', error)
    return NextResponse.json({ error: 'Could not do that' }, { status: 500 })
  }

  return NextResponse.json({ likeCount: await countFor(supabase, commentId), likedByMe: true })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, commentId } = await params
  const supabase = createServiceClient()
  if (!(await gate(supabase, id, commentId, userId))) {
    return NextResponse.json({ error: 'Not available' }, { status: 403 })
  }

  const { error } = await supabase
    .from('plan_comment_likes')
    .delete()
    .eq('comment_id', commentId)
    .eq('user_id', userId)

  if (error) {
    console.error('unlike failed:', error)
    return NextResponse.json({ error: 'Could not do that' }, { status: 500 })
  }

  return NextResponse.json({ likeCount: await countFor(supabase, commentId), likedByMe: false })
}
