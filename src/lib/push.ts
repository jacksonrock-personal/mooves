// Phase 15 Surface B — server-side Web Push send (FCM). Fired from the go-green
// route when a green is scoped to a group (visible_to). Notifies that group's
// members AND its owner (groupRecipientIds — group_members excludes owners)
// minus the mover, minus muters, minus groups inside the 60-min rate-limit
// floor. Aggregate/group-level only: never names a person.

import { createServiceClient } from '@/lib/supabase/server'
import { groupRecipientIds } from '@/lib/groups'
import { firebaseMessaging } from '@/lib/firebase/admin'
import { WAVE_TIME_PHRASE, type WaveTime } from '@/lib/blast'
import { checkRateLimit } from '@/lib/ratelimit'
import { COMMENT_PUSH_COOLDOWN_SECONDS } from '@/lib/comments'

const RATE_LIMIT_MS = 60 * 60 * 1000 // one push per group per hour

/**
 * Send a "someone in {group} is free" push to each scoped group's members.
 * Best-effort and self-contained: callers should not let a failure here break
 * the status write (wrap in try/catch). `groupIds` is the mover's visible_to.
 */
export async function sendGroupGreenPush(
  moverId: string,
  groupIds: string[],
  exclude?: Set<string>,
): Promise<void> {
  if (!groupIds.length) return
  const supabase = createServiceClient()

  // Only groups that exist and aren't inside the rate-limit floor.
  const { data: groups } = await supabase
    .from('groups')
    .select('id, name, last_notified_at')
    .in('id', groupIds)
  if (!groups?.length) return

  const now = Date.now()
  const eligibleGroups = groups.filter(
    g => !g.last_notified_at || now - new Date(g.last_notified_at).getTime() >= RATE_LIMIT_MS,
  )
  if (!eligibleGroups.length) return

  // One push per user per trigger. `exclude` carries viewers who just got a green
  // wave (17.1) — the wave supersedes the anonymous push for this same event.
  const alreadyTargeted = new Set<string>([moverId, ...(exclude ?? [])])
  const notifiedGroupIds: string[] = []
  const staleSubIds: string[] = []

  // Send per group so each notification carries the right group name.
  for (const group of eligibleGroups) {
    notifiedGroupIds.push(group.id) // refresh the floor regardless of recipient count

    const recipients = await groupRecipientIds(supabase, group.id)
    const candidateIds = recipients.filter(id => !alreadyTargeted.has(id))
    if (!candidateIds.length) continue

    // Drop members who muted this group.
    const { data: mutes } = await supabase
      .from('group_notification_mutes')
      .select('user_id')
      .eq('group_id', group.id)
      .in('user_id', candidateIds)
    const muted = new Set((mutes ?? []).map(m => m.user_id))
    const recipientIds = candidateIds.filter(id => !muted.has(id))
    if (!recipientIds.length) continue

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, fcm_token, user_id')
      .in('user_id', recipientIds)
    if (!subs?.length) continue

    for (const s of subs) alreadyTargeted.add(s.user_id)

    const res = await firebaseMessaging.sendEachForMulticast({
      tokens: subs.map(s => s.fcm_token),
      // Data-only: the service worker builds the notification (no duplicate display).
      data: {
        title: `Someone in ${group.name} is free`,
        body: 'Open Mooves to jump in.',
        url: '/feed',
      },
    })

    res.responses.forEach((r, i) => {
      if (r.success) return
      const code = r.error?.code
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-argument') {
        staleSubIds.push(subs[i].id)
      }
    })
  }

  // Refresh the rate-limit floor for every group we processed.
  if (notifiedGroupIds.length) {
    await supabase.from('groups').update({ last_notified_at: new Date().toISOString() }).in('id', notifiedGroupIds)
  }
  // Clean up tokens FCM reports as unregistered/invalid (revoked or expired).
  if (staleSubIds.length) {
    await supabase.from('push_subscriptions').delete().in('id', staleSubIds)
  }
}

/** Shared token send + stale-token cleanup, used by the plan pushes below. */
async function pushToUsers(
  supabase: ReturnType<typeof createServiceClient>,
  userIds: string[],
  data: { title: string; body: string; url: string },
): Promise<void> {
  if (!userIds.length) return

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, fcm_token')
    .in('user_id', userIds)
  if (!subs?.length) return

  const res = await firebaseMessaging.sendEachForMulticast({
    tokens: subs.map(s => s.fcm_token),
    data, // data-only: the service worker builds the notification
  })

  const stale: string[] = []
  res.responses.forEach((r, i) => {
    if (r.success) return
    const code = r.error?.code
    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-argument') {
      stale.push(subs[i].id)
    }
  })
  if (stale.length) await supabase.from('push_subscriptions').delete().in('id', stale)
}

/**
 * Phase 20.3 — a group-scoped Moove notifies that group, under the SAME 60-minute
 * per-group floor as a group-scoped green. A dated plan is higher-signal than a
 * green, so if anything earns a push it does, but it does not get its own budget.
 * Best-effort; callers wrap in try/catch so a push failure never fails the write.
 */
export async function sendPlanPush(
  authorId: string,
  groupIds: string[],
  title: string,
  _kind: 'created',
): Promise<void> {
  if (!groupIds.length) return
  const supabase = createServiceClient()

  const { data: groups } = await supabase
    .from('groups')
    .select('id, name, last_notified_at')
    .in('id', groupIds)
  if (!groups?.length) return

  const now = Date.now()
  const eligible = groups.filter(
    g => !g.last_notified_at || now - new Date(g.last_notified_at).getTime() >= RATE_LIMIT_MS,
  )
  if (!eligible.length) return

  const alreadyTargeted = new Set<string>([authorId])
  const notified: string[] = []

  for (const group of eligible) {
    notified.push(group.id)

    const recipients = await groupRecipientIds(supabase, group.id)
    const candidateIds = recipients.filter(id => !alreadyTargeted.has(id))
    if (!candidateIds.length) continue

    const { data: mutes } = await supabase
      .from('group_notification_mutes')
      .select('user_id')
      .eq('group_id', group.id)
      .in('user_id', candidateIds)
    const muted = new Set((mutes ?? []).map(m => m.user_id))
    const recipientIds = candidateIds.filter(id => !muted.has(id))
    if (!recipientIds.length) continue

    for (const id of recipientIds) alreadyTargeted.add(id)

    await pushToUsers(supabase, recipientIds, {
      title: `New Moove in ${group.name}`,
      body: title,
      url: '/feed',
    })
  }

  if (notified.length) {
    await supabase.from('groups').update({ last_notified_at: new Date().toISOString() }).in('id', notified)
  }
}

/**
 * Phase 20.9 — cancelling a Moove tells the people who were in it.
 *
 * Deliberately NOT rate-limited and NOT muteable: this is the one push in the
 * app that carries bad news someone is relying on. A cancelled Moove silently
 * vanishing on people who committed to it is exactly what this exists to stop.
 */
export async function sendPlanCancelledPush(
  authorId: string,
  joinerIds: string[],
  title: string,
): Promise<void> {
  const recipients = joinerIds.filter(id => id !== authorId)
  if (!recipients.length) return
  const supabase = createServiceClient()

  const { data: author } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', authorId)
    .maybeSingle()

  await pushToUsers(supabase, recipients, {
    title: `${author?.display_name ?? 'A friend'} cancelled a Moove`,
    body: title,
    url: '/feed',
  })
}

const WAVE_COOLDOWN_MS = 6 * 60 * 60 * 1000 // one wave push per viewer per 6h

// "Sam, Alex, and Jordan" — names, never a bare count (17.1 reverses the
// never-name guardrail for the wave surface only). total ≥ names.length.
function formatWaveNames(names: string[], total: number): string {
  const shown = names.slice(0, 3)
  let base: string
  if (shown.length <= 1) base = shown[0] ?? 'Your friends'
  else if (shown.length === 2) base = `${shown[0]} and ${shown[1]}`
  else base = `${shown[0]}, ${shown[1]}, and ${shown[2]}`
  const extra = total - shown.length
  return extra > 0 ? `${base} +${extra} more` : base
}

/**
 * Green wave (17.1, refined in 0008): fire a NAMED push to every viewer for whom
 * the mover going green completes a wave — a CONNECTED group of ≥3 of their green,
 * visible friends who share a time window (now/tonight/weekend), with the mover in
 * it. The graph + time logic lives in green_wave_candidates → wave_group_for_viewer.
 * Best-effort, and never allowed to break the go-green write (callers wrap in
 * try/catch). Returns the set of viewer ids we actually pushed to, so the caller can
 * suppress the anonymous group push for them this event (the escalation-ladder supersede).
 */
export async function sendGreenWave(moverId: string): Promise<Set<string>> {
  const sent = new Set<string>()
  const supabase = createServiceClient()

  const { data: candidates } = await supabase.rpc('green_wave_candidates', { mover: moverId })
  if (!candidates?.length) return sent

  const viewerIds = candidates.map(c => c.viewer)

  // Opt-out + 6h cooldown, per viewer.
  const { data: prefs } = await supabase
    .from('users')
    .select('id, wave_push_enabled, last_wave_at')
    .in('id', viewerIds)
  const prefById = new Map((prefs ?? []).map(p => [p.id, p]))

  const now = Date.now()
  const eligible = candidates.filter(c => {
    const p = prefById.get(c.viewer)
    if (!p || p.wave_push_enabled === false) return false
    if (p.last_wave_at && now - new Date(p.last_wave_at).getTime() < WAVE_COOLDOWN_MS) return false
    return true
  })
  if (!eligible.length) return sent

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, fcm_token, user_id')
    .in('user_id', eligible.map(c => c.viewer))
  if (!subs?.length) return sent

  const subsByUser = new Map<string, { id: string; token: string }[]>()
  for (const s of subs) {
    const list = subsByUser.get(s.user_id) ?? []
    list.push({ id: s.id, token: s.fcm_token })
    subsByUser.set(s.user_id, list)
  }

  const staleSubIds: string[] = []

  for (const c of eligible) {
    const userSubs = subsByUser.get(c.viewer)
    if (!userSubs?.length) continue
    const bucket: WaveTime = c.time_bucket in WAVE_TIME_PHRASE ? (c.time_bucket as WaveTime) : 'now'
    const res = await firebaseMessaging.sendEachForMulticast({
      tokens: userSubs.map(s => s.token),
      // Data-only: the service worker builds the notification (no duplicate display).
      data: {
        title: `${formatWaveNames(c.green_names ?? [], c.green_count)} are free ${WAVE_TIME_PHRASE[bucket]}`,
        body: 'Start something — text the group.',
        url: '/feed?wave=1',
      },
    })
    let delivered = false
    res.responses.forEach((r, i) => {
      if (r.success) { delivered = true; return }
      const code = r.error?.code
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-argument') {
        staleSubIds.push(userSubs[i].id)
      }
    })
    if (delivered) sent.add(c.viewer)
  }

  // Cooldown: stamp every viewer we actually reached.
  if (sent.size) {
    await supabase.from('users').update({ last_wave_at: new Date().toISOString() }).in('id', [...sent])
  }
  if (staleSubIds.length) {
    await supabase.from('push_subscriptions').delete().in('id', staleSubIds)
  }
  return sent
}

/**
 * Phase 21 — a new comment landed on a Moove.
 *
 * Recipients are the author plus everyone who is IN, minus the commenter. That
 * is the distinction that lets this through 15.3's ban on per-person pushes:
 * 15.3 forbade notifications ABOUT A PERSON'S AVAILABILITY ("friend X is
 * green"). This one is about AN OBJECT YOU PERSONALLY COMMITTED TO, it is
 * aggregate, and it is rate-limited by the same infrastructure.
 *
 * The copy never carries the comment text, never names who wrote it, and never
 * says how many people are going.
 *
 * On batching, honestly: this app has no scheduler, so there is no true batching
 * to be had. The first comment pushes and everything for the next hour is
 * SILENT rather than queued. To keep the wording true, the count is taken over
 * the trailing cooldown window, so it reads "1 new comment." when one landed and
 * "3 new comments." when three did. Real batching wants the Phase 22 scheduler.
 */
export async function sendCommentPush(
  planId: string,
  authorId: string,
  title: string,
  commenterId: string,
): Promise<void> {
  const supabase = createServiceClient()

  // plan_id is matched explicitly: a green join carries plan_id IS NULL and must
  // never be read as membership of a Moove.
  const { data: joins } = await supabase
    .from('move_joins')
    .select('joiner_id')
    .eq('plan_id', planId)

  const recipientIds = [...new Set([authorId, ...(joins ?? []).map(j => j.joiner_id)])].filter(
    id => id !== commenterId,
  )
  if (!recipientIds.length) return

  // One push per Moove per recipient per hour. Anyone inside their own cooldown
  // is dropped here, so a busy Moove cannot buzz a pocket more than once.
  const eligible: string[] = []
  for (const id of recipientIds) {
    if (await checkRateLimit(`comments:push:${planId}:${id}`, 1, COMMENT_PUSH_COOLDOWN_SECONDS)) {
      eligible.push(id)
    }
  }
  if (!eligible.length) return

  const since = new Date(Date.now() - COMMENT_PUSH_COOLDOWN_SECONDS * 1000).toISOString()
  const { count } = await supabase
    .from('plan_comments')
    .select('id', { count: 'exact', head: true })
    .eq('plan_id', planId)
    .gte('created_at', since)

  const n = count && count > 0 ? count : 1

  await pushToUsers(supabase, eligible, {
    title,
    body: n === 1 ? '1 new comment.' : `${n} new comments.`,
    url: '/feed',
  })
}
