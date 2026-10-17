// R37 — the 08:00 digest for text alerts held overnight.
//
// Called hourly by pg_cron via pg_net (migration 20261017120000_r37_text_alerts.sql),
// self-gated on CRON_SECRET exactly like /api/cron/photo-nudge: 404, not 401,
// when the secret is wrong, so the endpoint looks like nothing at all.
//
// For each person with queued rows that are due (due_at is their local 08:00):
//   1. rows whose Moove was cancelled or has expired → 'dropped'
//      (and everything for someone who opted out since → 'dropped')
//   2. one left → the single-alert copy; two or more → one digest
//   3. either way it is ONE text against the 5-a-day cap, claimed atomically
//      by sms_claim(); over the cap the rows become 'capped'
// Rows for anyone whose local clock is outside 08:00–21:59 (a late tick) stay
// queued for the next morning rather than buzzing a pocket at midnight.
//
// No-op while SMS_ALERTS_ENABLED is unset.

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { captureServerEvent } from '@/lib/posthog-server'
import { claimAndSend, isOptedIn, smsEnabled } from '@/lib/sms'
import {
  digestText,
  isSmsDaytime,
  singleAlertText,
  smsLocalDayStart,
  smsShortDay,
  smsWhen,
} from '@/lib/smsCopy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Rows per tick. A backlog bigger than this drains over the next ticks. */
const BATCH = 2000

function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) {
    timingSafeEqual(a, a)
    return false
  }
  return timingSafeEqual(a, b)
}

async function handle(req: Request) {
  const expected = process.env.CRON_SECRET
  const provided = req.headers.get('x-cron-secret')
  if (!expected || !provided || !secretMatches(provided, expected)) {
    return new NextResponse(null, { status: 404 })
  }

  if (!smsEnabled()) return NextResponse.json({ ok: true, enabled: false })

  const supabase = createServiceClient()
  const now = new Date()

  const { data: rows, error } = await supabase
    .from('sms_outbox')
    .select('id, user_id, plan_id')
    .eq('status', 'queued')
    .lte('due_at', now.toISOString())
    .order('due_at', { ascending: true })
    .limit(BATCH)
  if (error) {
    console.error('cron/sms-digest: outbox fetch failed:', error.message)
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 })
  }
  if (!rows?.length) return NextResponse.json({ ok: true, due: 0 })

  const planIds = [...new Set(rows.map(r => r.plan_id))]
  const userIds = [...new Set(rows.map(r => r.user_id))]

  const [{ data: plans }, { data: users }] = await Promise.all([
    supabase
      .from('plans')
      .select('id, author_id, title, start_at, has_time, time_mode, cancelled_at, expires_at')
      .in('id', planIds),
    supabase
      .from('users')
      .select('id, phone, timezone, sms_alerts_opt_in_at, sms_opted_out_at')
      .in('id', userIds),
  ])
  const planById = new Map((plans ?? []).map(p => [p.id, p]))
  const userById = new Map((users ?? []).map(u => [u.id, u]))

  // 1. Drop what can no longer be sent.
  const dropIds: string[] = []
  const live = rows.filter(r => {
    const p = planById.get(r.plan_id)
    const u = userById.get(r.user_id)
    const ok =
      !!p && !p.cancelled_at && new Date(p.expires_at).getTime() > now.getTime() && !!u && isOptedIn(u) && !!u.phone
    if (!ok) dropIds.push(r.id)
    return ok
  })
  if (dropIds.length) {
    await supabase.from('sms_outbox').update({ status: 'dropped' }).in('id', dropIds).eq('status', 'queued')
  }

  // Names for the single-alert case.
  const authorIds = [...new Set(live.map(r => planById.get(r.plan_id)!.author_id))]
  const { data: authors } = authorIds.length
    ? await supabase.from('users').select('id, display_name').in('id', authorIds)
    : { data: [] as { id: string; display_name: string | null }[] }
  const nameById = new Map((authors ?? []).map(a => [a.id, a.display_name]))

  const byUser = new Map<string, typeof live>()
  for (const r of live) {
    const list = byUser.get(r.user_id) ?? []
    list.push(r)
    byUser.set(r.user_id, list)
  }

  let singles = 0
  let digests = 0
  let capped = 0
  let deferred = 0

  for (const [userId, userRows] of byUser) {
    const u = userById.get(userId)!
    if (!isSmsDaytime(u.timezone, now)) {
      deferred += userRows.length
      continue
    }

    // In the order they will happen.
    const items = userRows
      .map(r => ({ row: r, plan: planById.get(r.plan_id)! }))
      .sort((a, b) => new Date(a.plan.start_at).getTime() - new Date(b.plan.start_at).getTime())

    let body: string
    if (items.length === 1) {
      const { plan } = items[0]
      body = singleAlertText({
        authorName: nameById.get(plan.author_id),
        title: plan.title,
        when: smsWhen({ startAt: plan.start_at, hasTime: plan.has_time, timeMode: plan.time_mode }, u.timezone, now),
        planId: plan.id,
      })
    } else {
      body = digestText(
        items.map(({ plan }) => ({
          title: plan.title,
          day: smsShortDay({ startAt: plan.start_at, hasTime: plan.has_time, timeMode: plan.time_mode }, u.timezone, now),
        })),
      )
    }

    const result = await claimAndSend(
      supabase,
      userId,
      u.phone,
      items.map(i => i.row.id),
      smsLocalDayStart(u.timezone, now),
      body,
    )
    if (result === 'sent') {
      if (items.length === 1) {
        singles += 1
        await captureServerEvent(userId, 'sms_sent', { kind: 'held' })
      } else {
        digests += 1
        await captureServerEvent(userId, 'sms_digest_sent', { mooves: items.length })
      }
    } else if (result === 'capped') {
      capped += 1
      await captureServerEvent(userId, 'sms_capped', { kind: 'digest', mooves: items.length })
    }
  }

  return NextResponse.json({
    ok: true,
    due: rows.length,
    dropped: dropIds.length,
    singles,
    digests,
    capped,
    deferred,
  })
}

export async function POST(req: Request) {
  return handle(req)
}

export async function GET(req: Request) {
  return handle(req)
}
