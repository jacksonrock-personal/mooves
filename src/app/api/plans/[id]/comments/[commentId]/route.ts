// Phase 21
// PATCH  /api/plans/[id]/comments/[commentId] — edit your own
// DELETE /api/plans/[id]/comments/[commentId] — delete your own, or remove any
//                                               comment on a Moove you host
//
// Moderation, in full. There is no report queue and no blocking anywhere in this
// app, so the safety story is: friends only, joined only, the host can remove
// anything on their own Moove, and every comment dies with the Moove within
// hours. That is honest at current scale and thin at ten times it — recorded in
// the spec as a deliberate acceptance rather than a gap nobody noticed.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { COMMENT_MAX } from '@/lib/comments'

type Supabase = ReturnType<typeof createServiceClient>

interface Target {
  commentAuthorId: string
  isHost: boolean
}

/**
 * Load the comment and work out what this user is allowed to do with it.
 *
 * The plan gate is repeated here rather than trusted from the URL: a comment on
 * an expired or cancelled Moove is unreachable for editing too, not just for
 * reading.
 */
async function target(
  supabase: Supabase,
  planId: string,
  commentId: string,
  userId: string,
): Promise<Target | null> {
  const { data: plan } = await supabase
    .from('plans')
    .select('id, author_id, cancelled_at, expires_at')
    .eq('id', planId)
    .maybeSingle()

  if (!plan) return null
  if (plan.cancelled_at) return null
  if (new Date(plan.expires_at) <= new Date()) return null

  const { data: comment } = await supabase
    .from('plan_comments')
    .select('id, author_id')
    .eq('id', commentId)
    .eq('plan_id', planId)
    .maybeSingle()

  if (!comment) return null
  return { commentAuthorId: comment.author_id, isHost: plan.author_id === userId }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, commentId } = await params
  const supabase = createServiceClient()

  const t = await target(supabase, id, commentId, userId)
  if (!t) return NextResponse.json({ error: 'Not available' }, { status: 404 })

  // Editing is yours alone. Hosting a Moove lets you REMOVE a comment, never
  // rewrite one — putting words in someone's mouth is a different power.
  if (t.commentAuthorId !== userId) {
    return NextResponse.json({ error: 'Not yours' }, { status: 403 })
  }

  const payload = (await req.json()) as { body?: string }
  const body = typeof payload.body === 'string' ? payload.body.trim() : ''
  if (!body) return NextResponse.json({ error: 'Say something first' }, { status: 400 })
  if (body.length > COMMENT_MAX) {
    return NextResponse.json({ error: 'That is too long' }, { status: 400 })
  }

  const { error } = await supabase
    .from('plan_comments')
    .update({ body, edited_at: new Date().toISOString() })
    .eq('id', commentId)

  if (error) {
    console.error('comment edit failed:', error)
    return NextResponse.json({ error: 'Could not save that' }, { status: 500 })
  }

  // Editing never pushes. Only a new comment is worth someone's pocket.
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, commentId } = await params
  const supabase = createServiceClient()

  const t = await target(supabase, id, commentId, userId)
  if (!t) return NextResponse.json({ error: 'Not available' }, { status: 404 })

  // Yours, or anyone's if you host this Moove.
  if (t.commentAuthorId !== userId && !t.isHost) {
    return NextResponse.json({ error: 'Not yours' }, { status: 403 })
  }

  const { error } = await supabase.from('plan_comments').delete().eq('id', commentId)

  if (error) {
    console.error('comment delete failed:', error)
    return NextResponse.json({ error: 'Could not remove that' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
