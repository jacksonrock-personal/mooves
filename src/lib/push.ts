// Phase 15 Surface B — server-side Web Push send (FCM). Fired from the go-green
// route when a green is scoped to a group (visible_to). Notifies that group's
// members via group_members — minus the mover, minus muters, minus groups inside
// the 60-min rate-limit floor. Aggregate/group-level only: never names a person.

import { createServiceClient } from '@/lib/supabase/server'
import { firebaseMessaging } from '@/lib/firebase/admin'

const RATE_LIMIT_MS = 60 * 60 * 1000 // one push per group per hour

/**
 * Send a "someone in {group} is free" push to each scoped group's members.
 * Best-effort and self-contained: callers should not let a failure here break
 * the status write (wrap in try/catch). `groupIds` is the mover's visible_to.
 */
export async function sendGroupGreenPush(moverId: string, groupIds: string[]): Promise<void> {
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

  const alreadyTargeted = new Set<string>([moverId]) // one push per user per trigger
  const notifiedGroupIds: string[] = []
  const staleSubIds: string[] = []

  // Send per group so each notification carries the right group name.
  for (const group of eligibleGroups) {
    notifiedGroupIds.push(group.id) // refresh the floor regardless of recipient count

    const { data: members } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', group.id)
    const candidateIds = (members ?? []).map(m => m.user_id).filter(id => !alreadyTargeted.has(id))
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
