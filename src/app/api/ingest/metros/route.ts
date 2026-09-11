// GET /api/ingest/metros — what the seeding routine needs before it searches.
//
// Phase 24.9. Bearer-authed, not user-authed: the caller is a scheduled Claude
// Code routine, not a person.
//
// It returns three things, and the third is the one that matters for cost:
//
//   · which metros are due a pull (see "due", below — R33 made this real)
//   · the window each one needs, which is normally ONE day, not seven
//   · FINGERPRINTS of what is already known there
//
// R33 — THIS USED TO RETURN EVERY METRO, EVERY RUN. The header above has claimed
// "staleness + the on-demand queue" since Phase 24.9 and there was no such
// filter: the handler selected the whole table and handed back all of it. That
// was harmless while the routine ran once a day and the list was four rows long,
// and it is the thing that made the list expensive to grow — every metro bought
// a web search on every run whether or not anything had changed there.
//
// It now returns only what is due, which is what makes two things affordable at
// once: metros that create themselves when users appear (ensure_metro_for_zip),
// and an HOURLY routine. A new metro is seeded within the hour instead of
// waiting for the next 10:07 UTC run, and the other 23 runs get an empty list
// and cost a round trip.
//
// Without the fingerprints the routine re-discovers and re-describes every
// recurring Thursday trivia night in the city, every single day, forever —
// paying tokens twice (once to find, once to write) for rows dedupe then throws
// away. They are title + venue only, deliberately: enough to recognise, not
// enough to cost anything to send.
//
// The window is incremental for the same reason. Day one needs seven days; after
// that most of the window is already covered and only the newly-entered day is
// new, with the near days re-scanned for late announcements. See RESCAN_DAYS for
// what that actually saves — this paragraph claimed "six-sevenths" for three
// releases after the constant below stopped being consistent with it.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const DAY_MS = 24 * 60 * 60 * 1000
const HORIZON_DAYS = 7

/**
 * Late announcements are real, so the near days are re-scanned every run.
 *
 * This is THE cost dial. A run searches `RESCAN_DAYS + 1` near days plus the one
 * day that just entered the horizon, so at 2 it was covering four days out of
 * seven — a ~43% saving, not the "six-sevenths" claimed in earlier versions of
 * this file and in three commit messages. At 1 it is three days.
 */
const RESCAN_DAYS = 1

/**
 * A metro this stale gets the full seven days again.
 *
 * Dropped from 7 days to 3 when the routine went to ONCE daily. At once-a-day, a
 * single missed or failed run leaves a hole no incremental window will ever go
 * back for — the newly-entered day is only offered on the day it enters. Seven
 * days meant a hole could sit there most of a week. Three means one missed run
 * self-heals within a couple of days.
 *
 * This is the one change here that can INCREASE cost, and only in the failure
 * case, which is exactly when you want it to.
 */
const FULL_RESCAN_MS = 3 * DAY_MS

/**
 * How long a handed-out metro is off the table before it can be handed out again.
 *
 * `last_successful_pull` only moves when the routine completes a POST, so a run
 * that takes the work list and then dies — rate limited, egress blocked, model
 * error — leaves the metro due. Without this it gets re-handed-out on the very
 * next tick, which at hourly means 24 searches a day for the one metro that is
 * already failing. Two hours is long enough not to thrash and short enough that
 * a transient failure still self-heals the same day.
 */
const RETRY_AFTER_MS = 2 * 60 * 60 * 1000

/**
 * A metro is due when it has not pulled successfully SINCE THE START OF TODAY
 * (UTC) — calendar-anchored, not a rolling 24h window.
 *
 * This matters more than it looks. The incremental window offers
 * `newlyEnteredDay` exactly once, on the day that day enters the horizon, so the
 * whole design is only correct if pulls land one per calendar day. A rolling
 * interval does not give you that: at 24h the pull time walks an hour later
 * every run until it crosses midnight and a day gets offered twice; at 23h it
 * walks earlier and a day gets skipped outright. Anchoring to the UTC day makes
 * "exactly one new day per run" true by construction rather than by luck of
 * scheduling.
 *
 * The cost shape is unchanged from the daily routine — still one pull per metro
 * per day. Going hourly only changes how soon a NEW metro gets its first one.
 */
function pulledToday(lastSuccessfulPull: string | null, now: Date): boolean {
  if (!lastSuccessfulPull) return false
  const startOfUtcDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return new Date(lastSuccessfulPull).getTime() >= startOfUtcDay
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function GET(req: Request) {
  const secret = process.env.INGEST_TOKEN
  if (!secret) return NextResponse.json({ error: 'Ingest not configured' }, { status: 503 })
  if (req.headers.get('authorization') !== `Bearer ${secret}`) return unauthorized()

  const supabase = createServiceClient()

  const { data: metros, error } = await supabase
    .from('metros')
    .select('id, name, state, last_successful_pull, last_attempted_pull')
  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 })

  const nowDate = new Date()
  const now = nowDate.getTime()
  const horizon = new Date(now + HORIZON_DAYS * DAY_MS).toISOString()

  // R33 — the queue. Everything below this line runs for DUE metros only, which
  // is what stops the per-run cost scaling with the size of the table instead of
  // with the amount of work there actually is.
  const due = (metros ?? []).filter(m => {
    if (pulledToday(m.last_successful_pull, nowDate)) return false
    const attempted = m.last_attempted_pull ? new Date(m.last_attempted_pull).getTime() : 0
    return now - attempted >= RETRY_AFTER_MS
  })

  // Stamped BEFORE the response goes out, not after the routine reports back.
  // The point of this column is to survive the case where the routine never
  // reports back at all, so writing it on success would defeat it entirely.
  if (due.length > 0) {
    const { error: stampError } = await supabase
      .from('metros')
      .update({ last_attempted_pull: nowDate.toISOString() })
      .in('id', due.map(m => m.id))
    // Non-fatal: worst case is this metro is offered again on the next tick,
    // which is the old behaviour and merely wasteful. Handing back an empty list
    // because a bookkeeping write failed would be worse — that is a metro going
    // dark for a day.
    if (stampError) console.error('last_attempted_pull stamp failed:', stampError)
  }

  const out = await Promise.all(
    due.map(async m => {
      const last = m.last_successful_pull ? new Date(m.last_successful_pull).getTime() : 0
      const stale = now - last
      // Never pulled, or stale past FULL_RESCAN_MS → full window. A brand-new
      // metro from ensure_metro_for_zip has last_successful_pull NULL and lands
      // here, which is what gets a just-arrived user seven days of feed rather
      // than the single day an incremental window would have offered.
      const full = stale >= FULL_RESCAN_MS
      // Always from today. It was `full ? 0 : 0` — a ternary that read as if it
      // decided something and never did.
      const fromDays = 0
      const toDays = full ? HORIZON_DAYS : RESCAN_DAYS
      // Incremental runs also need the day that just entered the horizon.
      const newlyEnteredDay = full ? null : HORIZON_DAYS

      const { data: known } = await supabase
        .from('sponsored_moves')
        .select('title, location_text')
        .eq('metro_id', m.id)
        .gte('start_at', new Date(now).toISOString())
        .lte('start_at', horizon)
        .limit(400)

      return {
        id: m.id,
        name: m.name,
        state: m.state,
        lastSuccessfulPull: m.last_successful_pull,
        window: { fromDays, toDays, newlyEnteredDay, full },
        // Recognition only. No descriptions — they would cost more to send than
        // the duplicates they prevent.
        known: (known ?? []).map(k => `${k.title} @ ${k.location_text ?? '?'}`),
      }
    }),
  )

  return NextResponse.json({ metros: out, horizonDays: HORIZON_DAYS })
}
