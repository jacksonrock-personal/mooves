// Phase 21
// GET  /api/plans/[id]/comments — every comment on a Moove you are in
// POST /api/plans/[id]/comments — say something to the people going
//
// This route is where two of the four walls are actually enforced:
//
//   2. ONLY FOR PEOPLE WHO JOINED. You need a move_joins row for THIS plan, or
//      you need to be the author. Commenting is coordination among people who
//      are going, not an audience talking at a plan.
//   3. INVISIBLE TO EVERYONE ELSE. A viewer who has not joined gets 403 from
//      GET, not an empty list — because an empty list is still an admission
//      that comments exist here, and the card must give away nothing.
//
// Wall 4 (dies with the Moove) is the expires_at / cancelled_at gate below.
// Wall 1 (only on a Moove) is structural: there is no green path to this table.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit, tooManyRequests } from '@/lib/ratelimit'
import { COMMENT_MAX, type PlanComment } from '@/lib/comments'
import { sendCommentPush } from '@/lib/push'

type Supabase = ReturnType<typeof createServiceClient>

interface Access {
  authorId: string
  title: string
  /** The author always has access, whether or not they are "in" their own Moove. */
  isHost: boolean
}

/**
 * Can this user read and write comments on this Moove right now?
 *
 * Deliberately NOT the same gate as joining. Being able to SEE a Moove earns you
 * nothing here — you have to have committed to it.
 */
async function access(
  supabase: Supabase,
  planId: string,
  userId: string,
): Promise<Access | null> {
  const { data: plan } = await supabase
    .from('plans')
    .select('id, author_id, title, cancelled_at, expires_at')
    .eq('id', planId)
    .maybeSingle()

  if (!plan) return null
  // Wall 4. Once the Moove is gone the comments are gone with it, and "gone"
  // means the same instant for both.
  if (plan.cancelled_at) return null
  if (new Date(plan.expires_at) <= new Date()) return null

  if (plan.author_id === userId) {
    return { authorId: plan.author_id, title: plan.title, isHost: true }
  }

  // Wall 2. `plan_id` is matched explicitly so a green join (plan_id IS NULL)
  // can never be mistaken for membership of a Moove.
  const { data: join } = await supabase
    .from('move_joins')
    .select('id')
    .eq('plan_id', planId)
    .eq('joiner_id', userId)
    .maybeSingle()

  if (!join) return null
  return { authorId: plan.author_id, title: plan.title, isHost: false }
}

/**
 * R8 — narrow a claimed mention list down to people actually in this Moove.
 *
 * Returns only ids that are the author or hold a plan join. Anything else is
 * dropped silently: the comment still posts, the tag simply does not become a
 * tag. Failing the whole write would turn a cosmetic overreach into a lost
 * comment, which is the worse outcome for a coordination surface.
 */
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

  const allowed = new Set<string>([...(joins ?? []).map(j => j.joiner_id)])
  if (wanted.includes(authorId)) allowed.add(authorId)
  return wanted.filter(id => allowed.has(id))
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  if (!(await access(supabase, id, userId))) {
    return NextResponse.json({ error: 'Not available' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('plan_comments')
    .select('id, author_id, body, created_at, edited_at, mentions, users:author_id (display_name, avatar_url)')
    .eq('plan_id', id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('load comments failed:', error)
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

  // R8 — likes, counted from the join table rather than a denormalised column.
  // The composite PK is the integrity story: one row per (comment, liker), so
  // there is no counter that can drift out of true.
  const ids = rows.map(r => r.id)
  const likeCounts = new Map<string, number>()
  const likedByMe = new Set<string>()
  if (ids.length) {
    const { data: likes } = await supabase
      .from('plan_comment_likes')
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

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Not an engagement throttle — a floor against a runaway client retrying.
  if (!(await checkRateLimit(`comments:post:${userId}`, 60, 3600))) return tooManyRequests()

  const supabase = createServiceClient()
  const gate = await access(supabase, id, userId)
  if (!gate) return NextResponse.json({ error: 'Not available' }, { status: 403 })

  const payload = (await req.json()) as { body?: string; mentions?: string[] }
  const body = typeof payload.body === 'string' ? payload.body.trim() : ''
  if (!body) return NextResponse.json({ error: 'Say something first' }, { status: 400 })
  if (body.length > COMMENT_MAX) {
    return NextResponse.json({ error: 'That is too long' }, { status: 400 })
  }

  // R8 — a tag may only ever name someone who is IN this Moove. Enforced here,
  // not just in the picker: a hand-built request naming an outsider has that id
  // dropped rather than stored. This is wall 2 applied to mentions — you cannot
  // pull someone into a room they were never in.
  const mentions = await validMentions(supabase, id, gate.authorId, payload.mentions)

  const { data, error } = await supabase
    .from('plan_comments')
    .insert({ plan_id: id, author_id: userId, body, mentions })
    .select('id, created_at')
    .single()

  if (error || !data) {
    console.error('comment insert failed:', error)
    return NextResponse.json({ error: 'Could not post that' }, { status: 500 })
  }

  // Never allowed to fail the write, same as every other push in the app.
  try {
    await sendCommentPush(id, gate.authorId, gate.title, userId)
  } catch {
    // best effort
  }

  return NextResponse.json({ id: data.id, createdAt: data.created_at }, { status: 201 })
}
