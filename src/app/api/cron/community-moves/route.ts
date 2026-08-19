// R27 — the community-moves janitor. Called hourly by pg_cron via pg_net
// (see 20260819140000_r27_community_autopublish.sql), same trust inversion and
// same shared secret as the Phase 22 availability tick.
//
// THIS ROUTE EXISTS BECAUSE THE PIPELINE FAILED SILENTLY FOR FIFTEEN DAYS.
//
// The seeding routine ran daily and perfectly the whole time. Rows landed. What
// stopped was the human approving them, and nothing anywhere measured that —
// so there was no error, no alert, and no way to tell an empty queue from an
// ignored one. Every metro was dark from 2026-08-11 and the first anyone knew
// of it was a user saying the community mooves looked stale.
//
// The lesson is not "approve faster". It is that a pipeline with a manual step
// in it needs to measure its OUTPUT, not its throughput. `last_successful_pull`
// was green every single day of the outage, because ingesting is not the point.
// The number that defines whether this feature is alive is how many approved
// moves are still in the future — and until this route, nothing computed it.
//
// Two passes:
//   1. sweep  — pending rows whose event has already happened
//   2. alarm  — metros running thin on upcoming live moves

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { sendMetroThinEmail } from '@/lib/email'
import { captureServerEvent } from '@/lib/posthog-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Below this many upcoming live moves, a metro is reported thin.
 *
 * Deliberately not zero. Zero is the state we already know is unrecoverable
 * without a human, and by the time it is reached the feed has been degrading
 * for days. Three gives roughly a day of warning at the observed rate of
 * events aging out, which is enough to act on and rare enough to still mean
 * something when it arrives.
 */
const THIN_THRESHOLD = 3

/** Re-report a still-thin metro at most once a day. */
const REALERT_MS = 24 * 60 * 60 * 1000

/** Constant-time compare that does not leak length through an early return. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) {
    timingSafeEqual(a, a)
    return false
  }
  return timingSafeEqual(a, b)
}

export async function POST(req: Request) {
  const expected = process.env.CRON_SECRET
  const provided = req.headers.get('x-cron-secret')
  // 404 rather than 401: an unauthenticated caller learns nothing about whether
  // this path exists. Same posture as the availability tick.
  if (!expected || !provided || !secretMatches(provided, expected)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const supabase = createServiceClient()
  const nowIso = new Date().toISOString()

  // ── Pass 1: sweep ──────────────────────────────────────────────────────────
  //
  // A pending row for an event that already happened can never become useful.
  // Left alone they accumulate forever — 289 of the 386 rows in the backlog
  // that triggered this work were already expired, and that wall of dead cards
  // is a large part of why the queue stopped getting opened at all.
  //
  // Rejected rather than deleted: the row is evidence about what the routine
  // found and how long it sat, and a delete would erase the only trace of a
  // stall like this one.
  const { data: swept, error: sweepError } = await supabase
    .from('sponsored_moves')
    .update({ status: 'rejected', reject_reason: 'Expired before review' })
    .eq('status', 'pending')
    .lt('start_at', nowIso)
    .select('id')

  if (sweepError) console.error('community-moves sweep failed:', sweepError)

  // ── Pass 2: the freshness alarm ────────────────────────────────────────────
  const { data: metros, error: metroError } = await supabase
    .from('metros')
    .select('id, name, state, thin_alerted_at')

  if (metroError) {
    return NextResponse.json({ error: 'Metro query failed' }, { status: 500 })
  }

  const report: { metro: string; upcoming: number; alerted: boolean }[] = []

  for (const metro of metros ?? []) {
    const { count } = await supabase
      .from('sponsored_moves')
      .select('id', { count: 'exact', head: true })
      .eq('metro_id', metro.id)
      .eq('status', 'approved')
      .gt('start_at', nowIso)

    const upcoming = count ?? 0
    const thin = upcoming < THIN_THRESHOLD

    if (!thin) {
      // Recovered. Clearing the stamp is what makes the next dip alert again.
      if (metro.thin_alerted_at) {
        await supabase.from('metros').update({ thin_alerted_at: null }).eq('id', metro.id)
      }
      report.push({ metro: metro.name, upcoming, alerted: false })
      continue
    }

    const lastAlert = metro.thin_alerted_at ? new Date(metro.thin_alerted_at).getTime() : 0
    const due = Date.now() - lastAlert >= REALERT_MS
    if (!due) {
      report.push({ metro: metro.name, upcoming, alerted: false })
      continue
    }

    // Best-effort, exactly like every other send in this app: an alarm that
    // throws would take the sweep down with it, and the sweep is the half that
    // must not fail.
    try {
      await sendMetroThinEmail({
        metroName: metro.name,
        state: metro.state,
        upcoming,
        threshold: THIN_THRESHOLD,
      })
    } catch (e) {
      console.error('metro thin alert email failed:', e)
    }

    await captureServerEvent(metro.id, 'community_moves_metro_thin', {
      metro: metro.name,
      upcoming,
      threshold: THIN_THRESHOLD,
    })

    await supabase.from('metros').update({ thin_alerted_at: nowIso }).eq('id', metro.id)
    report.push({ metro: metro.name, upcoming, alerted: true })
  }

  return NextResponse.json({
    swept: swept?.length ?? 0,
    metros: report,
  })
}
