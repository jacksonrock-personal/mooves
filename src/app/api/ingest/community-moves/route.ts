// POST /api/ingest/community-moves — where the seeding routine's findings land.
//
// Phase 24.9. The routine never touches the database; it searches, structures
// and POSTs here. All validation, dedupe and persistence live in this file so
// that logic stays versioned, testable, and impossible for a half-finished run
// to corrupt.
//
// IDEMPOTENT BY CONSTRUCTION. Every row carries a dedupe key (normalised title +
// venue + start time) with a UNIQUE constraint behind it, so a double-run, a
// retry, or two overlapping schedules are all no-ops. That is what stands in for
// the retry semantics a proper cron would have given us.
//
// THE QUALITY GATE IS HERE, NOT IN THE PROMPT. A model asked nicely for a source
// URL will usually provide one; asked to invent an event it will do that too.
// Rows without a source URL, a venue, or a future start time are rejected before
// they reach the review queue, so the human pass is a glance rather than an
// investigation.
//
// Nothing here goes live. Everything lands as `pending`, exactly like a
// sponsor-authored move, and shows up in the existing admin queue.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

type MoveInsert = Database['public']['Tables']['sponsored_moves']['Insert']

export const dynamic = 'force-dynamic'

const DAY_MS = 24 * 60 * 60 * 1000
const HORIZON_MS = 8 * DAY_MS
/** 24.9 caps the routine at 5–10 per metro per day; this is the backstop. */
const MAX_PER_REQUEST = 40

interface IncomingMove {
  title?: unknown
  description?: unknown
  category?: unknown
  startAt?: unknown
  locationText?: unknown
  neighborhood?: unknown
  priceText?: unknown
  isFree?: unknown
  sourceUrl?: unknown
  imageUrl?: unknown
}

const str = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length > 0 ? t : null
}

/** Normalised title + venue + start time. Stable across sources that phrase the
 *  same event differently. */
function dedupeKey(title: string, venue: string, startAt: string): string {
  const flat = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  return `${flat(title)}|${flat(venue)}|${new Date(startAt).toISOString().slice(0, 16)}`
}

export async function POST(req: Request) {
  const secret = process.env.INGEST_TOKEN
  if (!secret) return NextResponse.json({ error: 'Ingest not configured' }, { status: 503 })
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { metroId?: unknown; moves?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 })
  }

  const metroId = str(body.metroId)
  if (!metroId) return NextResponse.json({ error: 'metroId required' }, { status: 400 })
  if (!Array.isArray(body.moves)) {
    return NextResponse.json({ error: 'moves must be an array' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // The metro has to exist, and its zip set is what area-matching needs. A move
  // with no area_zip would never surface, so an unmapped metro is an error
  // rather than a silent write.
  const { data: metro } = await supabase
    .from('metros')
    .select('id, lat, lng')
    .eq('id', metroId)
    .maybeSingle()
  if (!metro) return NextResponse.json({ error: 'Unknown metro' }, { status: 404 })

  const { count: zipCount } = await supabase
    .from('metro_zips')
    .select('zip', { count: 'exact', head: true })
    .eq('metro_id', metroId)
  if (!zipCount) {
    return NextResponse.json({ error: 'Metro has no zips; run seed-metros' }, { status: 409 })
  }

  // Stamp every move with the zip nearest the metro CENTROID.
  //
  // This used to be `metro_zips ... limit(1)`, i.e. an arbitrary row with no
  // ORDER BY — for Chicago that returned 60015 (Deerfield, a far north suburb)
  // rather than anything central. It happened to fall just inside a Logan Square
  // user's 25-mile radius, so it worked by luck, and Postgres is free to return
  // a different row after any change to the table. In a metro any wider than
  // Chicago the arbitrary pick lands outside the radius and the move is
  // ingested, approved, and then visible to nobody — the worst failure shape
  // there is, because nothing errors.
  //
  // The centroid is deterministic and maximally central, so it is inside the
  // radius of the most users the metro can reach.
  const { data: centroid } = await supabase
    .rpc('nearest_zip', { p_lat: metro.lat, p_lng: metro.lng })
    .maybeSingle<{ zip: string }>()
  const areaZip = centroid?.zip
  if (!areaZip) {
    return NextResponse.json({ error: 'Could not resolve metro centroid zip' }, { status: 409 })
  }

  const now = Date.now()
  const rejected: { title: string; reason: string }[] = []
  const rows: MoveInsert[] = []
  const seen = new Set<string>()

  for (const raw of (body.moves as IncomingMove[]).slice(0, MAX_PER_REQUEST)) {
    const title = str(raw.title)
    if (!title) {
      rejected.push({ title: '(untitled)', reason: 'no title' })
      continue
    }
    // The cheapest quality gate there is, and the one that makes review fast.
    const sourceUrl = str(raw.sourceUrl)
    if (!sourceUrl) {
      rejected.push({ title, reason: 'no source url' })
      continue
    }
    const venue = str(raw.locationText)
    if (!venue) {
      rejected.push({ title, reason: 'no venue' })
      continue
    }
    const startRaw = str(raw.startAt)
    const start = startRaw ? new Date(startRaw) : null
    if (!start || Number.isNaN(start.getTime())) {
      rejected.push({ title, reason: 'no fixed start time' })
      continue
    }
    if (start.getTime() < now) {
      rejected.push({ title, reason: 'already happened' })
      continue
    }
    if (start.getTime() > now + HORIZON_MS) {
      rejected.push({ title, reason: 'beyond the 7-day horizon' })
      continue
    }

    const key = dedupeKey(title, venue, start.toISOString())
    if (seen.has(key)) {
      rejected.push({ title, reason: 'duplicate within this batch' })
      continue
    }
    seen.add(key)

    rows.push({
      title,
      description: str(raw.description) ?? '',
      category: str(raw.category) ?? 'community',
      origin: 'seeded',
      status: 'pending',
      sponsor_id: null,
      metro_id: metroId,
      area_zip: areaZip,
      start_at: start.toISOString(),
      location_text: venue,
      neighborhood: str(raw.neighborhood),
      price_text: str(raw.priceText),
      is_free: typeof raw.isFree === 'boolean' ? raw.isFree : null,
      source_url: sourceUrl,
      image_url: str(raw.imageUrl),
      dedupe_key: key,
    })
  }

  let inserted = 0
  if (rows.length > 0) {
    // ignoreDuplicates: anything already known is a no-op, which is what makes
    // the whole route safe to run again.
    const { data, error } = await supabase
      .from('sponsored_moves')
      .upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true })
      .select('id')
    if (error) {
      console.error('community move ingest failed:', error)
      return NextResponse.json({ error: 'Insert failed' }, { status: 500 })
    }
    inserted = data?.length ?? 0
  }

  // Only a run that actually reached the database counts as successful. An empty
  // but valid run still counts — "nothing new in this city today" is a real
  // answer, and the routine is told to prefer it over padding.
  await supabase
    .from('metros')
    .update({ last_successful_pull: new Date().toISOString() })
    .eq('id', metroId)

  return NextResponse.json({
    received: Array.isArray(body.moves) ? body.moves.length : 0,
    inserted,
    duplicates: rows.length - inserted,
    rejected,
  })
}
