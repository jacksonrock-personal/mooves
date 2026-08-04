// GET /api/ingest/metros — what the seeding routine needs before it searches.
//
// Phase 24.9. Bearer-authed, not user-authed: the caller is a scheduled Claude
// Code routine, not a person.
//
// It returns three things, and the third is the one that matters for cost:
//
//   · which metros are due a pull (staleness + the on-demand queue)
//   · the window each one needs, which is normally ONE day, not seven
//   · FINGERPRINTS of what is already known there
//
// Without the fingerprints the routine re-discovers and re-describes every
// recurring Thursday trivia night in the city, every single day, forever —
// paying tokens twice (once to find, once to write) for rows dedupe then throws
// away. They are title + venue only, deliberately: enough to recognise, not
// enough to cost anything to send.
//
// The window is incremental for the same reason. Day one needs seven days; day
// two, six of those are already covered and only the newly-entered day is new.
// A full re-scan runs weekly to catch late announcements. That is roughly a
// six-sevenths saving in steady state, and it is what makes running three times
// a day affordable.

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
    .select('id, name, state, last_successful_pull')
  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 })

  const now = Date.now()
  const horizon = new Date(now + HORIZON_DAYS * DAY_MS).toISOString()

  const out = await Promise.all(
    (metros ?? []).map(async m => {
      const last = m.last_successful_pull ? new Date(m.last_successful_pull).getTime() : 0
      const stale = now - last
      // Never pulled, or gone a week without a successful one → full window.
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
