// GET  /api/admin/moves?view=review|gate|all — list moves (admin)
// POST /api/admin/moves — author a move (concierge). publish:true → approved.
// Admin-gated via requireAdmin; never trust a client admin claim.
//
// R27 — THE QUEUE STOPPED BEING A GATE.
//
// Seeded moves now publish on arrival, so the old single "everything pending"
// list no longer describes anything real. It also actively caused harm: it
// returned every pending row ever created, newest-first, with no filter on
// whether the event had already happened. By 2026-08-19 that was 386 cards of
// which 289 were for events in the past — opening it cost more than ignoring
// it, so it got ignored, and the feed went dark for fifteen days.
//
// Three views now, and the split is the point:
//
//   gate   — status='pending', still upcoming. The REAL gate, and after R27 it
//            holds only sponsor-authored moves: paid third-party placements
//            that must not publish without a human. Normally empty.
//   review — live, upcoming, reviewed_at IS NULL. The audit list: seeded moves
//            already visible to users that nobody has looked at yet. Clearing
//            it is optional and never blocks anything, which is exactly why it
//            is safe to leave for a week.
//   all    — everything, newest first. Unfiltered, for looking things up.
//
// Both actionable views sort by start_at ASCENDING and exclude anything already
// past. Soonest-first is the only order that matches what the work actually is:
// the move happening tonight is the one worth a glance, not the one ingested
// most recently.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin'
import { INTEREST_SLUGS } from '@/lib/interests'
import type { Database } from '@/types/database'

type MoveRow = Database['public']['Tables']['sponsored_moves']['Row']

function mapMove(m: MoveRow) {
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    category: m.category,
    brand: m.brand,
    areaZip: m.area_zip,
    radiusMiles: m.radius_miles,
    linkUrl: m.link_url,
    imageUrl: m.image_url,
    timeText: m.time_text,
    startAt: m.start_at,
    locationText: m.location_text,
    status: m.status,
    rejectReason: m.reject_reason,
    sponsorId: m.sponsor_id,
    // R27: the review list is a glance, and a glance needs the source link to
    // click through to and the neighbourhood to sanity-check the venue against.
    reviewedAt: m.reviewed_at,
    origin: m.origin,
    sourceUrl: m.source_url,
    neighborhood: m.neighborhood,
    impressions: m.impressions,
    clicks: m.clicks,
    interestedCount: m.interested_count,
    broughtOverCount: m.brought_over_count,
    createdAt: m.created_at,
  }
}

export async function GET(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!(await requireAdmin(userId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const view = new URL(req.url).searchParams.get('view') ?? 'review'
  const supabase = createServiceClient()
  const nowIso = new Date().toISOString()

  let query = supabase.from('sponsored_moves').select('*')

  if (view === 'gate') {
    query = query
      .eq('status', 'pending')
      .gt('start_at', nowIso)
      .order('start_at', { ascending: true })
  } else if (view === 'review') {
    query = query
      .eq('status', 'approved')
      .is('reviewed_at', null)
      .gt('start_at', nowIso)
      .order('start_at', { ascending: true })
  } else {
    query = query.order('created_at', { ascending: false }).limit(500)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 })

  // Both badge counts on every response. The console shows them side by side so
  // an empty gate reads as "nothing is blocked" rather than as a broken screen.
  const [{ count: gateCount }, { count: reviewCount }] = await Promise.all([
    supabase
      .from('sponsored_moves')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .gt('start_at', nowIso),
    supabase
      .from('sponsored_moves')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved')
      .is('reviewed_at', null)
      .gt('start_at', nowIso),
  ])

  return NextResponse.json({
    moves: (data ?? []).map(mapMove),
    gateCount: gateCount ?? 0,
    reviewCount: reviewCount ?? 0,
  })
}

export async function POST(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!(await requireAdmin(userId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await req.json()) as {
    title?: string
    description?: string
    category?: string
    brand?: string | null
    areaZip?: string
    radiusMiles?: number
    linkUrl?: string | null
    imageUrl?: string | null
    timeText?: string | null
    startAt?: string | null
    locationText?: string | null
    publish?: boolean
  }

  const title = body.title?.trim() ?? ''
  const description = body.description?.trim() ?? ''
  const category = body.category ?? ''
  const areaZip = body.areaZip?.trim() ?? ''

  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 })
  if (!description) return NextResponse.json({ error: 'Description required' }, { status: 400 })
  if (!INTEREST_SLUGS.includes(category)) return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  if (!/^\d{5}$/.test(areaZip)) return NextResponse.json({ error: 'Area ZIP must be 5 digits' }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('sponsored_moves')
    .insert({
      title,
      description,
      category,
      brand: body.brand?.trim() || null,
      area_zip: areaZip,
      radius_miles: typeof body.radiusMiles === 'number' && body.radiusMiles > 0 ? Math.round(body.radiusMiles) : 25,
      link_url: body.linkUrl?.trim() || null,
      image_url: body.imageUrl?.trim() || null,
      time_text: body.timeText?.trim() || null,
      start_at: body.startAt ?? null,
      location_text: body.locationText?.trim() || null,
      status: body.publish ? 'approved' : 'pending',
    })
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Create failed' }, { status: 500 })
  return NextResponse.json(mapMove(data), { status: 201 })
}

/**
 * PATCH /api/admin/moves — bulk mark-reviewed / bulk pull.
 *
 * On the collection rather than a /bulk child so it cannot be confused with
 * /api/admin/moves/[id], where a move whose id happened to be "bulk" would be
 * the kind of ambiguity nobody finds until it bites.
 *
 * Bulk exists because the review list is a GLANCE, not an investigation. The
 * old console approved one row at a time, which is defensible when every
 * approval is a publish decision — and untenable now that the list is 97 rows
 * of already-live content whose expected outcome is "all fine". A pass that
 * takes twenty minutes is a pass that does not happen, and a pass that does not
 * happen is what put the feed dark for a fortnight.
 *
 * Pull is bulk too, deliberately: the failure mode auto-publish introduces is a
 * bad SOURCE producing a run of bad rows, and that wants one action, not forty.
 */
export async function PATCH(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!(await requireAdmin(userId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await req.json()) as {
    ids?: unknown
    action?: 'reviewed' | 'pull'
    rejectReason?: string
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((i): i is string => typeof i === 'string') : []
  if (ids.length === 0) return NextResponse.json({ error: 'ids required' }, { status: 400 })
  if (ids.length > 500) return NextResponse.json({ error: 'Too many ids' }, { status: 400 })

  const reviewedAt = new Date().toISOString()
  let updates: { reviewed_at: string; status?: string; reject_reason?: string }

  if (body.action === 'reviewed') {
    updates = { reviewed_at: reviewedAt }
  } else if (body.action === 'pull') {
    const reason = body.rejectReason?.trim()
    if (!reason) return NextResponse.json({ error: 'Reject reason required' }, { status: 400 })
    updates = { reviewed_at: reviewedAt, status: 'rejected', reject_reason: reason }
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('sponsored_moves')
    .update(updates)
    .in('id', ids)
    .select('id')

  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  return NextResponse.json({ updated: data?.length ?? 0 })
}
