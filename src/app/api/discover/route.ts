// GET /api/discover — Community and Sponsored Mooves near the viewer.
//
// Rewritten for Phase 24. Two things that used to be load-bearing are gone, on
// purpose, and both were the point of the rewrite:
//
//   · THE SETUP GATE. This route used to return `needsSetup: true` and an empty
//     list whenever area or interests were missing, so a new user saw nothing
//     until they filled in a form. 24.8 kills that. Area still narrows results
//     when we have it; missing area is a wider search, not a wall.
//
//   · THE INTEREST FILTER. It used to `.in('category', interests)`, so a move
//     outside your tags was invisible no matter how good it was. 24.7 demotes
//     interests to LAST in the ranking weights. They now only tie-break, and
//     only for who gets named on a card (see nearMatch).
//
// `scope=feed` returns the handful the home feed embeds; `limit` is the caller's
// call because the count varies with how busy the viewer's own people are
// (feedCardCount). Browse (24.8) adds its filter params to this same route.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveArea } from '@/lib/geo'
import { buildSocialLine, type FriendSignal, type SocialLine } from '@/lib/nearMatch'
import { isSlotPart, type SlotPart } from '@/lib/availability'
import { seededShuffle } from '@/lib/seededShuffle'

/** Dated moves die 3h after they start; evergreen (start_at null) never does. */
const EXPIRY_GRACE_MS = 3 * 60 * 60 * 1000
const DEFAULT_LIMIT = 3
const MAX_LIMIT = 50

/**
 * With `?seed=`, how deep to read before picking.
 *
 * The feed embeds one to three cards, and without this it embedded the same one
 * to three every single time — always the soonest — so a shelf whose whole job
 * is "here is something to do" showed one thing forever and stopped being worth
 * a glance. The seed reshuffles it per app open (see lib/seededShuffle).
 *
 * The pool is still ordered soonest-first, so this trades "always the very next
 * thing" for "something from the next couple of dozen", not for anything stale:
 * the expiry floor above has already dropped everything that has been and gone.
 */
const SHUFFLE_POOL = 24

export interface NearMove {
  id: string
  title: string
  description: string
  category: string
  /** 'sponsor' → paid placement · 'seeded' | 'house' → Community Moove. */
  origin: string
  brand: string | null
  timeText: string | null
  startAt: string | null
  neighborhood: string | null
  locationText: string | null
  priceText: string | null
  isFree: boolean | null
  imageUrl: string | null
  linkUrl: string | null
  sourceUrl: string | null
  interestedByMe: boolean
  social: SocialLine | null
}

export async function GET(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const limit = Math.min(
    Math.max(Number(url.searchParams.get('limit')) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  )

  // Absent (Browse, which wants the real soonest-first list) or a uint32 from
  // the caller. A malformed seed is treated as absent rather than as 0, so a
  // broken client gets the old deterministic order instead of one fixed shuffle
  // that every broken client shares.
  const rawSeed = url.searchParams.get('seed')
  const parsedSeed = rawSeed === null ? NaN : Number(rawSeed)
  const seed = Number.isFinite(parsedSeed) ? Math.abs(Math.trunc(parsedSeed)) >>> 0 : null

  const supabase = createServiceClient()

  const { data: me } = await supabase
    .from('users')
    .select('area_zip, interests, timezone')
    .eq('id', userId)
    .single()

  const areaZip = me?.area_zip ?? null
  const viewerTimezone = me?.timezone || 'America/Chicago'

  // Area narrows when we have it. Without it we do NOT bail — that was the gate.
  let zips: string[] | null = null
  let area: { zip: string; city: string | null; state: string | null } | null = null
  if (areaZip) {
    const match = await resolveArea(supabase, areaZip)
    zips = match ? match.nearbyZips : [areaZip]
    area = match
      ? { zip: match.zip, city: match.city, state: match.state }
      : { zip: areaZip, city: null, state: null }
  }

  const expiryFloor = new Date(Date.now() - EXPIRY_GRACE_MS).toISOString()

  let query = supabase
    .from('sponsored_moves')
    .select(
      'id, title, description, category, origin, brand, time_text, start_at, neighborhood, location_text, price_text, is_free, image_url, link_url, source_url',
    )
    .eq('status', 'approved')
    // Live = approved AND (Mooves-authored/seeded OR the placement charge cleared).
    .or('sponsor_id.is.null,paid_at.not.is.null')
    .or(`start_at.is.null,start_at.gt.${expiryFloor}`)
    .order('start_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (zips) query = query.in('area_zip', zips)

  const { data: rows, error } = await query.limit(seed === null ? limit : Math.max(limit, SHUFFLE_POOL))
  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 })

  // Narrowed to what we will actually return BEFORE anything downstream runs:
  // the social lines and the impression counter both key off this list, and an
  // impression for a card nobody was shown is a billing bug, not a rounding one.
  const moves = seed === null ? (rows ?? []) : seededShuffle(rows ?? [], seed, m => m.id).slice(0, limit)
  if (moves.length === 0) {
    return NextResponse.json({ area, hasArea: !!areaZip, moves: [] })
  }

  const moveIds = moves.map(m => m.id)

  // ── who the viewer can be told about ──────────────────────────────────────
  // Only confirmed friends, ever. 24.0 wall 2: never public, never the sponsor,
  // never a stranger who happens to share a metro.
  const { data: friendRows } = await supabase
    .from('friendships')
    .select('friend_id')
    .eq('user_id', userId)
  const friendIds = (friendRows ?? []).map(f => f.friend_id)

  let friends: FriendSignal[] = []
  const groupNames = new Map<string, string>()

  if (friendIds.length > 0) {
    const [{ data: people }, { data: slots }, { data: myGroups }] = await Promise.all([
      supabase
        .from('users')
        .select('id, display_name, avatar_url, is_available, status_expires_at, interests, hide_from_matches, timezone')
        .in('id', friendIds),
      supabase.from('availability_slots').select('user_id, slot_date, part').in('user_id', friendIds),
      supabase.from('group_members').select('group_id').eq('user_id', userId),
    ])

    // Only groups the VIEWER is in can be named, and only their members counted.
    const myGroupIds = (myGroups ?? []).map(g => g.group_id)
    const membership = new Map<string, string[]>()
    if (myGroupIds.length > 0) {
      const [{ data: groups }, { data: members }] = await Promise.all([
        supabase.from('groups').select('id, name').in('id', myGroupIds),
        supabase.from('group_members').select('group_id, user_id').in('group_id', myGroupIds),
      ])
      for (const g of groups ?? []) groupNames.set(g.id, g.name)
      for (const m of members ?? []) {
        const list = membership.get(m.user_id) ?? []
        list.push(m.group_id)
        membership.set(m.user_id, list)
      }
    }

    const slotsByUser = new Map<string, { date: string; part: SlotPart }[]>()
    for (const s of slots ?? []) {
      if (!isSlotPart(s.part)) continue
      const list = slotsByUser.get(s.user_id) ?? []
      list.push({ date: s.slot_date, part: s.part })
      slotsByUser.set(s.user_id, list)
    }

    friends = (people ?? []).map(p => ({
      id: p.id,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
      hideFromMatches: p.hide_from_matches,
      interests: p.interests ?? [],
      groupIds: membership.get(p.id) ?? [],
      isAvailable: p.is_available,
      statusExpiresAt: p.status_expires_at,
      slots: slotsByUser.get(p.id) ?? [],
      timezone: p.timezone,
    }))
  }

  // ── declared: who tapped "I'd go" ─────────────────────────────────────────
  // The friend-scoped read 24.0 repealed "aggregate-only" to allow. Scoped to
  // the viewer's own friends plus the viewer, and nothing else.
  const { data: interested } = await supabase
    .from('move_interested')
    .select('move_id, user_id')
    .in('move_id', moveIds)
    .in('user_id', [...friendIds, userId])

  const declaredByMove = new Map<string, string[]>()
  const mine = new Set<string>()
  for (const row of interested ?? []) {
    if (row.user_id === userId) {
      mine.add(row.move_id)
      continue
    }
    const list = declaredByMove.get(row.move_id) ?? []
    list.push(row.user_id)
    declaredByMove.set(row.move_id, list)
  }

  // Aggregate impressions — batch, race-free, never tied to an identity (13.7).
  void supabase.rpc('increment_move_impressions', { move_ids: moveIds }).then(({ error: e }) => {
    if (e) console.error('impressions increment failed:', e)
  })

  const payload: NearMove[] = moves.map(m => ({
    id: m.id,
    title: m.title,
    description: m.description,
    category: m.category,
    origin: m.origin,
    brand: m.brand,
    timeText: m.time_text,
    startAt: m.start_at,
    neighborhood: m.neighborhood,
    locationText: m.location_text,
    priceText: m.price_text,
    isFree: m.is_free,
    imageUrl: m.image_url,
    linkUrl: m.link_url,
    sourceUrl: m.source_url,
    interestedByMe: mine.has(m.id),
    social: buildSocialLine({
      startAt: m.start_at,
      category: m.category,
      declaredFriendIds: declaredByMove.get(m.id) ?? [],
      friends,
      groupNames,
      viewerTimezone,
    }),
  }))

  return NextResponse.json({ area, hasArea: !!areaZip, moves: payload })
}
