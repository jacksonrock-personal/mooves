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
/** A metro not pulled in this long gets the full seven days again. */
const FULL_RESCAN_MS = 7 * DAY_MS
/** Late announcements are real, so the near days are re-scanned every run. */
const RESCAN_DAYS = 2
const HORIZON_DAYS = 7

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
      const fromDays = full ? 0 : 0
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
