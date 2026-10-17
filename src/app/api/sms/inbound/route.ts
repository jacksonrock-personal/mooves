// POST /api/sms/inbound
// Twilio webhook — fires when someone texts the Mooves toll-free number.
// Looks up the sender, finds their green friends (respecting group visibility),
// and returns a TwiML SMS reply. Uses the service role to query across users.
//
// R37 — the same number now sends text alerts, so the carrier keywords are
// answered FIRST, before the feed check ever runs:
//   STOP · STOPALL · UNSUBSCRIBE · CANCEL · END · QUIT → opt out, empty TwiML
//     (Twilio sends the carrier's own confirmation; we add nothing)
//   START · UNSTOP → opt back in, empty TwiML
//   HELP · INFO    → the help line
// Matching is on the whole message after trim/uppercase/punctuation-strip, so
// "Stop." is STOP and "stop texting me tacos" is a feed check.

import { createServiceClient } from '@/lib/supabase/server'
import { validateTwilioSignature, twimlResponse, emptyTwimlResponse } from '@/lib/twilio'
import { classifyKeyword, SMS_HELP_TEXT, SMS_START_KEYWORD_VERSION } from '@/lib/smsCopy'
import { captureServerEvent } from '@/lib/posthog-server'
import { userGroupIds } from '@/lib/groups'

type GreenFriend = {
  id: string
  display_name: string | null
  status_note: string | null
  visible_to: string[] | null
}

// ── Reply copy ────────────────────────────────────────────────────────────────
function composeReply(friends: GreenFriend[]): string {
  if (friends.length === 0) {
    return "Nobody's free right now. You could be first, open Mooves to go green."
  }

  const format = (f: GreenFriend) =>
    f.status_note ? `${f.display_name} (${f.status_note})` : (f.display_name ?? 'Someone')

  if (friends.length <= 4) {
    const names = friends.map(format)
    const list =
      names.length === 1
        ? names[0]
        : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]
    const verb = friends.length === 1 ? 'is' : 'are'
    return `${list} ${verb} free right now.`
  }

  // 5+ friends: name first 3, count the rest
  const named = friends.slice(0, 3).map(format).join(', ')
  const rest = friends.length - 3
  return `${named}, and ${rest} others are free right now.`
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const formData = await req.formData()

  // Validate the Twilio signature before doing any work.
  const params: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') params[key] = value
  }
  const signature = req.headers.get('x-twilio-signature') ?? ''
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/sms/inbound`
  if (!validateTwilioSignature(signature, url, params)) {
    return new Response('Forbidden', { status: 403 })
  }

  const from = params.From
  if (!from) {
    return twimlResponse("Couldn't process that. Try again in a moment.")
  }

  const supabase = createServiceClient()

  // R37 — carrier keywords first. Answered for anyone, user or not.
  const keyword = classifyKeyword(params.Body)
  if (keyword === 'help') return twimlResponse(SMS_HELP_TEXT)
  if (keyword === 'stop' || keyword === 'start') {
    const { data: who } = await supabase
      .from('users')
      .select('id, sms_consent_version')
      .eq('phone', from)
      .maybeSingle()
    if (who) {
      const now = new Date().toISOString()
      const { error } =
        keyword === 'stop'
          ? await supabase
              .from('users')
              .update({ sms_opted_out_at: now, sms_opted_out_via: 'stop' })
              .eq('id', who.id)
          : await supabase
              .from('users')
              .update({
                sms_alerts_opt_in_at: now,
                // Keep the disclosure they actually agreed to; someone who
                // never opted in on a screen is on record as joining by keyword.
                sms_consent_version: who.sms_consent_version ?? SMS_START_KEYWORD_VERSION,
                sms_opted_out_at: null,
                sms_opted_out_via: null,
              })
              .eq('id', who.id)
      if (error) console.error(`sms inbound ${keyword} write failed:`, error.message)
      await captureServerEvent(
        who.id,
        keyword === 'stop' ? 'text_alerts_opted_out' : 'text_alerts_opted_in',
        { source: 'keyword' },
      )
    }
    return emptyTwimlResponse()
  }

  // 1. Look up sender by phone number
  const { data: sender } = await supabase
    .from('users')
    .select('id')
    .eq('phone', from)
    .single()

  if (!sender) {
    return twimlResponse(
      "Hey! Looks like you're not on Mooves yet. Join at makemooves.app"
    )
  }

  // Known Mooves user — record the check (best-effort, non-blocking on failure).
  await captureServerEvent(sender.id, 'sms_feed_check')

  // 2. Get sender's friend IDs
  const { data: friendships } = await supabase
    .from('friendships')
    .select('friend_id')
    .eq('user_id', sender.id)

  if (!friendships || friendships.length === 0) {
    return twimlResponse(
      "You haven't connected with anyone on Mooves yet. Open the app to invite some friends."
    )
  }

  const friendIds = friendships.map(f => f.friend_id)

  // 3. Get green friends
  const { data: greenFriends } = await supabase
    .from('users')
    .select('id, display_name, status_note, visible_to')
    .in('id', friendIds)
    .eq('is_available', true)

  if (!greenFriends || greenFriends.length === 0) {
    return twimlResponse(
      "Nobody's free right now. You could be first, open Mooves to go green."
    )
  }

  // 4. Resolve group visibility. A green friend with visible_to = null is public.
  //    Otherwise `visible_to` holds GROUP IDs — the sender only sees them if
  //    they're in at least one of those groups. "In" includes owning it:
  //    group_members excludes owners, so this must go through userGroupIds.
  const targetedGroupIds = Array.from(
    new Set(
      greenFriends.flatMap(f => (Array.isArray(f.visible_to) ? f.visible_to : []))
    )
  )

  const senderGroupIds = await userGroupIds(supabase, sender.id, targetedGroupIds)

  const visible = greenFriends.filter(
    f =>
      f.visible_to === null ||
      (Array.isArray(f.visible_to) &&
        f.visible_to.some(gid => senderGroupIds.has(gid)))
  )

  return twimlResponse(composeReply(visible))
}
