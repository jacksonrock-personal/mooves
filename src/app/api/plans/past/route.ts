// R36 + R39
// GET /api/plans/past — the Mooves you started or joined that are over.
//
//   ?q=        search title or place across the whole history (≥ 2 chars)
//   ?cursor=   the nextCursor from the previous page
//   ?limit=    page size, 1–50, default 20 (the feed preview asks for 2)
//
// Membership is author OR a move_joins row for that plan (never a plan_id IS
// NULL green row), via the past_mooves RPC. Cancelled Mooves are left out.
// Newest first, keyset-paged on (start_at, id). An empty first page is the cue
// for the feed to render no Past section at all (R31's no-empty-furniture rule).
//
// photoCount is a TOTAL, returned only to members — never an unread count.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  PAST_PAGE_SIZE,
  PAST_SEARCH_MIN,
  PHOTO_BUCKET,
  PHOTO_URL_TTL_SECONDS,
  type AlbumPerson,
  type PastMoove,
  type PastPage,
} from '@/lib/photos'
import type { PlanTimeMode } from '@/lib/plans'

/** Thumbnails per row: the strip on the Past page shows four. */
const THUMBS = 4
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** "2026-10-11T19:30:00.000Z~<uuid>" → its parts, or null if it is not one of ours. */
function parseCursor(raw: string | null): { start: string; id: string } | null {
  if (!raw) return null
  const [start, id] = raw.split('~')
  if (!start || !id || !UUID_RE.test(id) || Number.isNaN(Date.parse(start))) return null
  return { start, id }
}

export async function GET(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const rawQ = (url.searchParams.get('q') ?? '').trim().slice(0, 80)
  const q = rawQ.length >= PAST_SEARCH_MIN ? rawQ : ''
  const cursor = parseCursor(url.searchParams.get('cursor'))
  const limitParam = Number(url.searchParams.get('limit'))
  const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : PAST_PAGE_SIZE

  const supabase = createServiceClient()

  // One extra row says whether another page exists.
  const { data: rows, error } = await supabase.rpc('past_mooves', {
    viewer: userId,
    ...(q ? { q } : {}),
    ...(cursor ? { before_start: cursor.start, before_id: cursor.id } : {}),
    page_size: limit + 1,
  })
  if (error) {
    console.error('past mooves failed:', error)
    return NextResponse.json({ error: 'Could not load' }, { status: 500 })
  }

  const plans = (rows ?? []).slice(0, limit)
  const hasMore = (rows ?? []).length > limit
  const last = plans[plans.length - 1]
  const nextCursor = hasMore && last ? `${new Date(last.start_at).toISOString()}~${last.id}` : null

  const empty: PastPage = { moves: [], nextCursor: null }
  if (plans.length === 0) return NextResponse.json(empty)
  const planIds = plans.map(p => p.id)

  // Rosters: author + joiners, author first.
  const { data: joins } = await supabase
    .from('move_joins')
    .select('plan_id, joiner_id, created_at')
    .in('plan_id', planIds)
    .order('created_at', { ascending: true })

  const rosterIds = new Map<string, string[]>()
  for (const p of plans) rosterIds.set(p.id, [p.author_id])
  for (const j of joins ?? []) {
    if (!j.plan_id) continue
    const list = rosterIds.get(j.plan_id)
    if (list && !list.includes(j.joiner_id)) list.push(j.joiner_id)
  }

  const allUserIds = [...new Set([...rosterIds.values()].flat())]
  const { data: users } = await supabase
    .from('users')
    .select('id, display_name, avatar_url')
    .in('id', allUserIds)
  const userById = new Map((users ?? []).map(u => [u.id, u]))

  // Photos: newest first, so the first few per plan are the thumbnails.
  const { data: photos } = await supabase
    .from('plan_photos')
    .select('plan_id, storage_path, created_at')
    .in('plan_id', planIds)
    .order('created_at', { ascending: false })

  const photosByPlan = new Map<string, string[]>()
  for (const ph of photos ?? []) {
    const list = photosByPlan.get(ph.plan_id) ?? []
    list.push(ph.storage_path)
    photosByPlan.set(ph.plan_id, list)
  }

  const thumbPaths = [...photosByPlan.values()].flatMap(l => l.slice(0, THUMBS))
  const signed = new Map<string, string>()
  if (thumbPaths.length) {
    const { data: urls } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(thumbPaths, PHOTO_URL_TTL_SECONDS)
    for (const u of urls ?? []) {
      if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl)
    }
  }

  const moves: PastMoove[] = plans.map(p => {
    const people: AlbumPerson[] = (rosterIds.get(p.id) ?? []).map(id => ({
      id,
      displayName: userById.get(id)?.display_name ?? null,
      avatarUrl: userById.get(id)?.avatar_url ?? null,
    }))
    const paths = photosByPlan.get(p.id) ?? []
    return {
      id: p.id,
      title: p.title,
      startAt: p.start_at,
      hasTime: p.has_time,
      timeMode: p.time_mode as PlanTimeMode,
      locationText: p.location_text,
      isCreator: p.author_id === userId,
      authorId: p.author_id,
      people,
      thumbs: paths
        .slice(0, THUMBS)
        .map(path => signed.get(path))
        .filter((u): u is string => !!u),
      photoCount: paths.length,
    }
  })

  const page: PastPage = { moves, nextCursor }
  return NextResponse.json(page)
}
