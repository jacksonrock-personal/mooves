// R36 — the morning-after nudge: "Add your photos from {title}".
//
// Called hourly by pg_cron via pg_net (migration 20261016140000_r36_photo_albums.sql),
// self-gated on CRON_SECRET exactly like /api/cron/availability: 404, not 401,
// when the secret is wrong, so the endpoint looks like nothing at all.
//
// Who is due: a Moove that is over, not cancelled, not yet nudged, whose start
// fell on "yesterday" and where it is now 09:00–10:00 — both judged in the
// AUTHOR's stored timezone, using the same localClock/inPushWindow the Phase 22
// scheduler uses. One push per Moove means one clock, and the author's is the
// one the Moove was planned on. An author with no stored zone falls back to
// UTC 15:00–16:00 (morning across the US) against yesterday's UTC date.
//
// Once, ever: plans.photo_nudge_sent_at is stamped after a successful send.
// The window is an hour wide and the tick is hourly, so each Moove gets exactly
// one chance; a missed morning is not backfilled at 2pm.

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { sendPhotoNudgePush } from '@/lib/push'
import { captureServerEvent } from '@/lib/posthog-server'
import { addDaysToDateStr, inPushWindow, localClock } from '@/lib/availability'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** UTC fallback window for authors with no stored zone. */
const FALLBACK_UTC_HOUR = 15

function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) {
    timingSafeEqual(a, a)
    return false
  }
  return timingSafeEqual(a, b)
}

/** Is it the morning after this Moove's start, in this zone? */
function isMorningAfter(startAt: string, timezone: string | null, now: Date): boolean {
  const nowClock = localClock(timezone, now)
  const startClock = localClock(timezone, new Date(startAt))
  if (nowClock && startClock) {
    return inPushWindow(nowClock) && startClock.dateStr === addDaysToDateStr(nowClock.dateStr, -1)
  }
  // No usable zone: UTC fallback.
  if (now.getUTCHours() !== FALLBACK_UTC_HOUR) return false
  const today = now.toISOString().slice(0, 10)
  return new Date(startAt).toISOString().slice(0, 10) === addDaysToDateStr(today, -1)
}

async function handle(req: Request) {
  const expected = process.env.CRON_SECRET
  const provided = req.headers.get('x-cron-secret')
  if (!expected || !provided || !secretMatches(provided, expected)) {
    return new NextResponse(null, { status: 404 })
  }

  const supabase = createServiceClient()
  const now = new Date()

  // Anything that could possibly be "yesterday" somewhere: started in the last
  // three days. Bounds the scan and means first deploy never nudges a backlog.
  const { data: plans, error } = await supabase
    .from('plans')
    .select('id, author_id, title, start_at')
    .is('photo_nudge_sent_at', null)
    .is('cancelled_at', null)
    .lte('expires_at', now.toISOString())
    .gte('start_at', new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString())

  if (error) {
    console.error('cron/photo-nudge: plan fetch failed:', error.message)
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 })
  }
  if (!plans?.length) return NextResponse.json({ ok: true, considered: 0, nudged: 0 })

  const authorIds = [...new Set(plans.map(p => p.author_id))]
  const { data: authors } = await supabase.from('users').select('id, timezone').in('id', authorIds)
  const tzById = new Map((authors ?? []).map(a => [a.id, a.timezone]))

  const due = plans.filter(p => isMorningAfter(p.start_at, tzById.get(p.author_id) ?? null, now))

  let nudged = 0
  for (const plan of due) {
    const { data: joins } = await supabase
      .from('move_joins')
      .select('joiner_id')
      .eq('plan_id', plan.id)
    const recipients = [...new Set([plan.author_id, ...(joins ?? []).map(j => j.joiner_id)])]

    // Send first, stamp second: a failed send retries never (window is one
    // tick wide), a failed stamp risks one duplicate — the safer direction.
    try {
      await sendPhotoNudgePush(plan.id, plan.title, recipients)
      await supabase
        .from('plans')
        .update({ photo_nudge_sent_at: new Date().toISOString() })
        .eq('id', plan.id)
      nudged += 1
      await captureServerEvent(plan.author_id, 'album_nudge_pushed', { recipients: recipients.length })
    } catch (e) {
      console.error('cron/photo-nudge: send failed for plan', plan.id, e)
    }
  }

  return NextResponse.json({ ok: true, considered: plans.length, due: due.length, nudged })
}

export async function POST(req: Request) {
  return handle(req)
}

export async function GET(req: Request) {
  return handle(req)
}
