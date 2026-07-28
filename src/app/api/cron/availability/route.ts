// Phase 22 — the scheduler tick. The first server-side scheduler in this app.
//
// Called by pg_cron via pg_net every 15 minutes (see migration
// 20260728030000_phase22_scheduled_availability.sql). This is the FIRST time
// the database calls out to the app rather than the app reaching in, which
// inverts the trust direction — so this route carries its own auth and is in
// the middleware's public-prefix list, alongside the Stripe and Twilio webhooks
// which self-gate the same way.
//
// Two passes, both keyed on "is it between 09:00 and 10:00 where this user is":
//
//   1. the weekly nudge  — on your ritual day, if you have not set a week
//   2. the confirm       — on any day you marked slots for
//
// Why an HOUR-wide window rather than an instant: it makes the job self-healing.
// The "already sent" stamps are written only after a send succeeds, so a tick
// that fails is retried by the next one fifteen minutes later, up to four times.
// If the whole hour is missed the day's push is missed and NOT backfilled — a
// confirm arriving at 2pm for a 9am window is noise, and noise from a scheduler
// is how people turn pushes off for good.
//
// Why every 15 minutes rather than hourly: not every zone is a whole hour off
// UTC. India is +5:30, Nepal +5:45, Chatham +12:45.

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWeekNudgePush, sendConfirmPush } from '@/lib/push'
import { captureServerEvent } from '@/lib/posthog-server'
import {
  localClock,
  inPushWindow,
  addDaysToDateStr,
  isSlotPart,
  SLOT_LABEL,
  SLOT_WINDOW,
  type SlotPart,
} from '@/lib/availability'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Constant-time compare that does not leak length through an early return. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) {
    // Still burn a comparison so a wrong length is not measurably faster.
    timingSafeEqual(a, a)
    return false
  }
  return timingSafeEqual(a, b)
}

interface CronUser {
  id: string
  timezone: string | null
  week_ritual_day: number
  week_push_enabled: boolean
  last_week_push_on: string | null
  last_confirm_push_on: string | null
  is_available: boolean
  status_expires_at: string | null
}

export async function POST(req: Request) {
  const expected = process.env.CRON_SECRET
  const provided = req.headers.get('x-cron-secret')

  // 404, not 401: an endpoint that answers "unauthorized" has advertised that it
  // exists. This one should look like nothing at all to anyone without the key.
  if (!expected || !provided || !secretMatches(provided, expected)) {
    return new NextResponse(null, { status: 404 })
  }

  const supabase = createServiceClient()
  const now = new Date()

  // Only users who have a stored zone can be scheduled at all. A user without
  // one is skipped silently and picks a zone up on their next app open — that
  // nullability IS the rollout, so this is the expected path for everyone who
  // has not opened the app since this shipped, not an error case.
  const { data: users, error } = await supabase
    .from('users')
    .select(
      'id, timezone, week_ritual_day, week_push_enabled, last_week_push_on, last_confirm_push_on, is_available, status_expires_at',
    )
    .not('timezone', 'is', null)

  if (error) {
    console.error('cron/availability: user fetch failed:', error.message)
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 })
  }

  // Narrow to people for whom it is currently the send window, before touching
  // any other table. Everything below runs on a handful of users per tick.
  const due: { user: CronUser; dateStr: string; weekday: number }[] = []
  for (const u of (users ?? []) as CronUser[]) {
    const clock = localClock(u.timezone, now)
    if (!clock) continue // unknown or malformed zone: skip, never throw
    if (!inPushWindow(clock)) continue
    due.push({ user: u, dateStr: clock.dateStr, weekday: clock.weekday })
  }

  if (due.length === 0) {
    return NextResponse.json({ ok: true, considered: users?.length ?? 0, nudged: 0, confirmed: 0 })
  }

  // One slot query for everyone due, spanning today through a week ahead: the
  // confirm pass needs today, the nudge pass needs "has this user set ANY of
  // the coming week" to know whether to stay quiet.
  const dates = due.map(d => d.dateStr).sort()
  const { data: slots } = await supabase
    .from('availability_slots')
    .select('user_id, slot_date, part')
    .in('user_id', due.map(d => d.user.id))
    .gte('slot_date', dates[0])
    .lte('slot_date', addDaysToDateStr(dates[dates.length - 1], 6))

  const byUser = new Map<string, { slot_date: string; part: string }[]>()
  for (const s of slots ?? []) {
    const list = byUser.get(s.user_id) ?? []
    list.push({ slot_date: s.slot_date, part: s.part })
    byUser.set(s.user_id, list)
  }

  const nudgeIds: string[] = []
  const confirmRecipients: { userId: string; slotLabels: string[] }[] = []
  const nudgeStamps = new Map<string, string[]>() // local date → user ids
  const confirmStamps = new Map<string, string[]>()

  for (const { user, dateStr, weekday } of due) {
    const mine = byUser.get(user.id) ?? []

    // ── Pass 1: the weekly nudge ──────────────────────────────────────────
    const isRitualDay = weekday === user.week_ritual_day
    if (
      isRitualDay &&
      user.week_push_enabled &&
      user.last_week_push_on !== dateStr &&
      // Setting your week early (say, on Sunday) suppresses Monday's nudge.
      mine.filter(s => s.slot_date >= dateStr).length === 0
    ) {
      nudgeIds.push(user.id)
      nudgeStamps.set(dateStr, [...(nudgeStamps.get(dateStr) ?? []), user.id])
    }

    // ── Pass 2: the confirm ───────────────────────────────────────────────
    const todaysParts = mine
      .filter(s => s.slot_date === dateStr)
      .map(s => s.part)
      .filter(isSlotPart)

    // Not on your own ritual day: slots you set at 9:10 do not need confirming
    // at 9:15. Not if you are already green: you do not need asking whether you
    // are free when you have already said so.
    const alreadyGreen =
      user.is_available &&
      (!user.status_expires_at || new Date(user.status_expires_at).getTime() > now.getTime())

    if (
      todaysParts.length > 0 &&
      !isRitualDay &&
      !alreadyGreen &&
      user.last_confirm_push_on !== dateStr
    ) {
      const ordered = [...new Set(todaysParts)].sort(
        (a: SlotPart, b: SlotPart) => SLOT_WINDOW[a].start - SLOT_WINDOW[b].start,
      )
      confirmRecipients.push({
        userId: user.id,
        slotLabels: ordered.map(p => SLOT_LABEL[p]),
      })
      confirmStamps.set(dateStr, [...(confirmStamps.get(dateStr) ?? []), user.id])
    }
  }

  // Send first, stamp second. A stamp written before a failed send would mean a
  // silently skipped day; a send followed by a failed stamp means at worst one
  // duplicate, which is the direction to fail in.
  let nudged = 0
  if (nudgeIds.length) {
    try {
      await sendWeekNudgePush(nudgeIds)
      nudged = nudgeIds.length
      for (const [dateStr, ids] of nudgeStamps) {
        await supabase.from('users').update({ last_week_push_on: dateStr }).in('id', ids)
      }
      for (const id of nudgeIds) await captureServerEvent(id, 'week_nudge_pushed')
    } catch (e) {
      console.error('cron/availability: nudge send failed, will retry next tick:', e)
    }
  }

  let confirmed = 0
  if (confirmRecipients.length) {
    try {
      await sendConfirmPush(confirmRecipients)
      confirmed = confirmRecipients.length
      for (const [dateStr, ids] of confirmStamps) {
        await supabase.from('users').update({ last_confirm_push_on: dateStr }).in('id', ids)
      }
      for (const r of confirmRecipients) {
        await captureServerEvent(r.userId, 'availability_confirm_pushed', {
          slots: r.slotLabels.length,
        })
      }
    } catch (e) {
      console.error('cron/availability: confirm send failed, will retry next tick:', e)
    }
  }

  return NextResponse.json({
    ok: true,
    considered: users?.length ?? 0,
    inWindow: due.length,
    nudged,
    confirmed,
  })
}
