// R36
// GET  /api/plans/[id]/photos/[photoId]/comments — every comment on one photo
// POST /api/plans/[id]/photos/[photoId]/comments — say something about it
//
// A mirror of the Phase 21 Moove comment routes, with one deliberate,
// documented difference: ⚠ WALL 4 IS AMENDED FOR PHOTO COMMENTS ONLY. These
// live as long as the photo does, so there is no expiry gate here — the album
// is by definition a Moove that is over.
//
// Walls 1–3 hold exactly:
//   1. only on a Moove — photo → plan, both NOT NULL;
//   2. only author + joiners — canAccessAlbum, NOT the R28 "anyone who can see
//      it" widening. An album belongs to the people who were there;
//   3. invisible to everyone else — 404, never an empty list.
//
// Mentions are roster-bounded (R8): only the author or a joiner of THIS plan
// can be named. R11's outsider tagging does NOT apply here, because an
// outsider could not open the album the tag would point them at — so there is
// no tag push, and a mentioned member is covered by the ordinary comment push.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit, tooManyRequests } from '@/lib/ratelimit'
import { COMMENT_MAX, type PlanComment } from '@/lib/comments'
import { canAccessAlbum, photoInAlbum } from '@/lib/photos'
import { sendPhotoCommentPush } from '@/lib/push'

type Supabase = ReturnType<typeof createServiceClient>

const notFound = () => NextResponse.json({ error: 'Not found' }, { status: 404 })

/** Narrow claimed mentions to the room: the author, or a joiner of THIS plan. */
async function validMentions(
  supabase: Supabase,
  planId: string,
  authorId: string,
  claimed: unknown,
): Promise<string[]> {
  if (!Array.isArray(claimed) || claimed.length === 0) return []
  const wanted = [...new Set(claimed.filter((v): v is string => typeof v === 'string'))].slice(0, 20)
  if (wanted.length === 0) return []

  const { data: joins } = await supabase
    .from('move_joins')
    .select('joiner_id')
    .eq('plan_id', planId)
    .in('joiner_id', wanted)

  const inRoom = new Set<string>((joins ?? []).map(j => j.joiner_id))
  if (wanted.includes(authorId)) inRoom.add(authorId)
  return wanted.filter(id => inRoom.has(id))
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, photoId } = await params
  const supabase = createServiceClient()

  if (!(await canAccessAlbum(supabase, id, userId))) return notFound()
  if (!(await photoInAlbum(supabase, id, photoId))) return notFound()

  const { data, error } = await supabase
    .from('plan_photo_comments')
    .select('id, author_id, body, created_at, edited_at, mentions, users:author_id (display_name, avatar_url)')
    .eq('photo_id', photoId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('load photo comments failed:', error)
    return NextResponse.json({ error: 'Could not load' }, { status: 500 })
  }

  type Row = {
    id: string
    author_id: string
    body: string
    created_at: string
    edited_at: string | null
    mentions: string[] | null
    users: { display_name: string | null; avatar_url: string | null } | null
  }
  const rows = (data ?? []) as unknown as Row[]

  const ids = rows.map(r => r.id)
  const likeCounts = new Map<string, number>()
  const likedByMe = new Set<string>()
  if (ids.length) {
    const { data: likes } = await supabase
      .from('plan_photo_comment_likes')
      .select('comment_id, user_id')
      .in('comment_id', ids)
    for (const l of likes ?? []) {
      likeCounts.set(l.comment_id, (likeCounts.get(l.comment_id) ?? 0) + 1)
      if (l.user_id === userId) likedByMe.add(l.comment_id)
    }
  }

  const comments: PlanComment[] = rows.map(r => ({
    id: r.id,
    authorId: r.author_id,
    authorName: r.users?.display_name ?? null,
    authorAvatar: r.users?.avatar_url ?? null,
    body: r.body,
    createdAt: r.created_at,
    editedAt: r.edited_at,
    likeCount: likeCounts.get(r.id) ?? 0,
    likedByMe: likedByMe.has(r.id),
    mentions: r.mentions ?? [],
  }))

  return NextResponse.json({ comments })
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, photoId } = await params

  // Same floor as Moove comments, its own bucket.
  if (!(await checkRateLimit(`photo-comments:post:${userId}`, 60, 3600))) return tooManyRequests()

  const supabase = createServiceClient()
  const gate = await canAccessAlbum(supabase, id, userId)
  if (!gate) return notFound()
  if (!(await photoInAlbum(supabase, id, photoId))) return notFound()

  let payload: { body?: unknown; mentions?: unknown }
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

  const mentions = await validMentions(supabase, id, gate.authorId, payload.mentions)

  const { data, error } = await supabase
    .from('plan_photo_comments')
    .insert({ photo_id: photoId, author_id: userId, body, mentions })
    .select('id, created_at')
    .single()

  if (error || !data) {
    console.error('photo comment insert failed:', error)
    return NextResponse.json({ error: 'Could not post that' }, { status: 500 })
  }

  try {
    await sendPhotoCommentPush(id, gate.title, userId)
  } catch {
    // best effort
  }

  return NextResponse.json({ id: data.id, createdAt: data.created_at }, { status: 201 })
}
