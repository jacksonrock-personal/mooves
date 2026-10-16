// R36
// PATCH  /api/plans/[id]/photos/[photoId]/comments/[commentId] — edit your own
// DELETE /api/plans/[id]/photos/[photoId]/comments/[commentId] — delete your
//        own, or remove any comment if you started this Moove
//
// Mirrors Phase 21's [commentId] route. The creator may REMOVE a comment,
// never rewrite one. Album access (author + joiners, plan over, not cancelled)
// replaces the expiry gate, because photo comments outlive the Moove by design.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { COMMENT_MAX } from '@/lib/comments'
import { canAccessAlbum, photoInAlbum } from '@/lib/photos'

type Supabase = ReturnType<typeof createServiceClient>

interface Target {
  commentAuthorId: string
  isCreator: boolean
}

async function target(
  supabase: Supabase,
  planId: string,
  photoId: string,
  commentId: string,
  userId: string,
): Promise<Target | null> {
  const gate = await canAccessAlbum(supabase, planId, userId)
  if (!gate) return null
  if (!(await photoInAlbum(supabase, planId, photoId))) return null

  const { data: comment } = await supabase
    .from('plan_photo_comments')
    .select('id, author_id')
    .eq('id', commentId)
    .eq('photo_id', photoId)
    .maybeSingle()

  if (!comment) return null
  return { commentAuthorId: comment.author_id, isCreator: gate.isCreator }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; photoId: string; commentId: string }> },
) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, photoId, commentId } = await params
  const supabase = createServiceClient()

  const t = await target(supabase, id, photoId, commentId, userId)
  if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (t.commentAuthorId !== userId) {
    return NextResponse.json({ error: 'Not yours' }, { status: 403 })
  }

  let payload: { body?: unknown }
  try {
    payload = (await req.json()) as typeof payload
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  const body = typeof payload.body === 'string' ? payload.body.trim() : ''
  if (!body) return NextResponse.json({ error: 'Say something first' }, { status: 400 })
  if (body.length > COMMENT_MAX) {
    return NextResponse.json({ error: 'That is too long' }, { status: 400 })
  }

  const { error } = await supabase
    .from('plan_photo_comments')
    .update({ body, edited_at: new Date().toISOString() })
    .eq('id', commentId)

  if (error) {
    console.error('photo comment edit failed:', error)
    return NextResponse.json({ error: 'Could not save that' }, { status: 500 })
  }

  // Editing never pushes.
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; photoId: string; commentId: string }> },
) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, photoId, commentId } = await params
  const supabase = createServiceClient()

  const t = await target(supabase, id, photoId, commentId, userId)
  if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (t.commentAuthorId !== userId && !t.isCreator) {
    return NextResponse.json({ error: 'Not yours' }, { status: 403 })
  }

  const { error } = await supabase.from('plan_photo_comments').delete().eq('id', commentId)
  if (error) {
    console.error('photo comment delete failed:', error)
    return NextResponse.json({ error: 'Could not remove that' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
