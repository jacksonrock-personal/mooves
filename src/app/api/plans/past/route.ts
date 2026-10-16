// R36
// GET /api/plans/past — the Mooves you started or joined that are over.
//
// Membership is author OR a move_joins row for that plan (never a plan_id IS
// NULL green row). Cancelled Mooves are left out. Newest first. An empty list
// is the cue for the feed to render no Past section at all (R31's
// no-empty-furniture rule).
//
// photoCount is a TOTAL, returned only to members — never an unread count.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  PHOTO_BUCKET,
  PHOTO_URL_TTL_SECONDS,
  type AlbumPerson,
  type PastMoove,
} from '@/lib/photos'
import type { PlanTimeMode } from '@/lib/plans'

/** Enough history to be useful, bounded so one heavy user cannot make this slow. */
const PAST_LIMIT = 60

export async function GET(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const nowIso = new Date().toISOString()

  const { data: myJoins } = await supabase
    .from('move_joins')
    .select('plan_id')
    .eq('joiner_id', userId)
    .not('plan_id', 'is', null)
  const joinedIds = [...new Set((myJoins ?? []).map(j => j.plan_id).filter((v): v is string => !!v))]

  const cols = 'id, author_id, title, start_at, has_time, time_mode, location_text'
  const [authored, joined] = await Promise.all([
    supabase
      .from('plans')
      .select(cols)
      .eq('author_id', userId)
      .is('cancelled_at', null)
      .lte('expires_at', nowIso)
      .order('start_at', { ascending: false })
      .limit(PAST_LIMIT),
    joinedIds.length
      ? supabase
          .from('plans')
          .select(cols)
          .in('id', joinedIds)
          .is('cancelled_at', null)
          .lte('expires_at', nowIso)
          .order('start_at', { ascending: false })
          .limit(PAST_LIMIT)
      : Promise.resolve({ data: [] as never[], error: null }),
  ])

  if (authored.error || joined.error) {
    console.error('past mooves failed:', authored.error ?? joined.error)
    return NextResponse.json({ error: 'Could not load' }, { status: 500 })
  }

  const byId = new Map<string, NonNullable<typeof authored.data>[number]>()
  for (const p of [...(authored.data ?? []), ...(joined.data ?? [])]) byId.set(p.id, p)
  const plans = [...byId.values()]
    .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime())
    .slice(0, PAST_LIMIT)

  if (plans.length === 0) return NextResponse.json({ moves: [] })
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

  // Photos: newest first, so the first three per plan are the thumbnails.
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

  const thumbPaths = [...photosByPlan.values()].flatMap(l => l.slice(0, 3))
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
        .slice(0, 3)
        .map(path => signed.get(path))
        .filter((u): u is string => !!u),
      photoCount: paths.length,
    }
  })

  return NextResponse.json({ moves })
}
