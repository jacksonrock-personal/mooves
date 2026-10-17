// R37 — Text alerts: the sending half. Server only.
//
// A text when a DIRECT friend makes a Moove you can see. Never a friend-of-a-
// friend Moove (open_to_fof widens the feed, never the texts), never a
// Discover/community Moove, never your own. New Mooves only.
//
// Ships dark: with SMS_ALERTS_ENABLED unset, enqueuePlanAlerts returns before
// touching the database — no rows, no sends — so turning it on later never
// releases a backlog.
//
// Timing is the RECIPIENT's clock (users.timezone, America/Chicago fallback):
//   08:00–21:59 → sent now, if under the cap
//   overnight   → queued for their next 08:00, where /api/cron/sms-digest
//                 folds everything waiting into one text
// The cap (5 a day, digest included) is enforced in Postgres by sms_claim(),
// under a per-recipient lock, so concurrent creates cannot overshoot it.

import { createServiceClient } from '@/lib/supabase/server'
import { groupRecipientIds } from '@/lib/groups'
import { sendSms } from '@/lib/twilio'
import { captureServerEvent } from '@/lib/posthog-server'
import {
  SMS_DAILY_CAP,
  isSmsDaytime,
  nextSmsMorning,
  singleAlertText,
  smsLocalDayStart,
  smsWhen,
} from '@/lib/smsCopy'

export {
  SMS_CONSENT_VERSION,
  SMS_START_KEYWORD_VERSION,
  SMS_DAILY_CAP,
  SMS_HELP_TEXT,
} from '@/lib/smsCopy'

type Service = ReturnType<typeof createServiceClient>

/** The kill switch. Only 'true' turns texts on. */
export function smsEnabled(): boolean {
  return process.env.SMS_ALERTS_ENABLED === 'true'
}

/** Opted in = opted in at some point, and not opted out since. */
export function isOptedIn(u: { sms_alerts_opt_in_at: string | null; sms_opted_out_at: string | null }): boolean {
  return u.sms_alerts_opt_in_at !== null && u.sms_opted_out_at === null
}

/**
 * Claim a slot under the cap and, if granted, send. Rows that lose the claim
 * are marked 'capped' by sms_claim itself; a send Twilio refuses is marked
 * 'dropped', which hands the slot back.
 */
export async function claimAndSend(
  supabase: Service,
  userId: string,
  phone: string,
  rowIds: string[],
  dayStart: Date,
  body: string,
): Promise<'sent' | 'capped' | 'failed'> {
  const { data: sentAt, error } = await supabase.rpc('sms_claim', {
    p_user: userId,
    p_row_ids: rowIds,
    p_day_start: dayStart.toISOString(),
    p_cap: SMS_DAILY_CAP,
  })
  if (error) {
    // Fail closed: a text we cannot count is a text we do not send.
    console.error('sms_claim failed:', error.message)
    return 'failed'
  }
  if (!sentAt) return 'capped'

  const ok = await sendSms(phone, body)
  if (!ok) {
    await supabase.from('sms_outbox').update({ status: 'dropped', sent_at: null }).in('id', rowIds)
    return 'failed'
  }
  return 'sent'
}

/**
 * Who may be texted about this Moove: the author's direct friends who can see
 * it under the same rule get_plans' first-degree arm uses.
 *   neither groups nor people picked → every friend
 *   otherwise → friends in any picked group (owners included) ∪ picked people
 */
async function audienceFor(
  supabase: Service,
  plan: { author_id: string; visible_to: string[] | null; visible_user_ids: string[] | null },
): Promise<string[]> {
  // Viewers who have the author as a friend, exactly as get_plans reads it.
  const { data: rows } = await supabase
    .from('friendships')
    .select('user_id')
    .eq('friend_id', plan.author_id)
  const friends = new Set((rows ?? []).map(r => r.user_id))
  friends.delete(plan.author_id)
  if (!friends.size) return []

  const groups = plan.visible_to?.length ? plan.visible_to : null
  const people = plan.visible_user_ids?.length ? plan.visible_user_ids : null
  if (!groups && !people) return [...friends]

  const allowed = new Set<string>(people ?? [])
  for (const gid of groups ?? []) {
    for (const id of await groupRecipientIds(supabase, gid)) allowed.add(id)
  }
  return [...friends].filter(id => allowed.has(id))
}

/**
 * Fan a newly created Moove out to opted-in friends. Best-effort: callers run
 * it after the response and swallow anything it throws.
 */
export async function enqueuePlanAlerts(planId: string): Promise<void> {
  if (!smsEnabled()) return

  const supabase = createServiceClient()
  const { data: plan } = await supabase
    .from('plans')
    .select('id, author_id, title, start_at, has_time, time_mode, visible_to, visible_user_ids, cancelled_at, expires_at')
    .eq('id', planId)
    .maybeSingle()
  if (!plan || plan.cancelled_at || new Date(plan.expires_at).getTime() <= Date.now()) return

  const audience = await audienceFor(supabase, plan)
  if (!audience.length) return

  const { data: recipients } = await supabase
    .from('users')
    .select('id, phone, timezone, sms_alerts_opt_in_at, sms_opted_out_at')
    .in('id', audience)
    .not('sms_alerts_opt_in_at', 'is', null)
    .is('sms_opted_out_at', null)
  const optedIn = (recipients ?? []).filter(r => isOptedIn(r) && r.phone && r.id !== plan.author_id)
  if (!optedIn.length) return

  const { data: author } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', plan.author_id)
    .maybeSingle()

  const now = new Date()
  const byId = new Map(optedIn.map(r => [r.id, r]))
  const daytime = new Set(optedIn.filter(r => isSmsDaytime(r.timezone, now)).map(r => r.id))

  // One row per (recipient, Moove), ever. ignoreDuplicates means a retried
  // create gets nothing back for people already handled, so it texts nobody.
  const { data: inserted, error } = await supabase
    .from('sms_outbox')
    .upsert(
      optedIn.map(r => ({
        user_id: r.id,
        plan_id: plan.id,
        due_at: (daytime.has(r.id) ? now : nextSmsMorning(r.timezone, now)).toISOString(),
        status: 'queued',
      })),
      { onConflict: 'user_id,plan_id', ignoreDuplicates: true },
    )
    .select('id, user_id')
  if (error) {
    console.error('sms_outbox insert failed:', error.message)
    return
  }

  const toSend = (inserted ?? []).filter(row => daytime.has(row.user_id))
  const planTime = { startAt: plan.start_at, hasTime: plan.has_time, timeMode: plan.time_mode }

  // Small batches: Twilio's REST client is happy in parallel, but a 100-friend
  // author should not open 100 sockets from one function invocation.
  for (let i = 0; i < toSend.length; i += 10) {
    await Promise.all(
      toSend.slice(i, i + 10).map(async row => {
        const r = byId.get(row.user_id)
        if (!r) return
        const body = singleAlertText({
          authorName: author?.display_name,
          title: plan.title,
          when: smsWhen(planTime, r.timezone, now),
          planId: plan.id,
        })
        const result = await claimAndSend(supabase, r.id, r.phone, [row.id], smsLocalDayStart(r.timezone, now), body)
        if (result === 'sent') await captureServerEvent(r.id, 'sms_sent', { kind: 'single' })
        else if (result === 'capped') await captureServerEvent(r.id, 'sms_capped', { kind: 'single' })
      }),
    )
  }
}
