// POST /api/sms/inbound
// Twilio webhook — fires when someone texts the Mooves toll-free number.
// Looks up the sender, finds their green friends, returns a TwiML SMS reply.
// Uses service role to query across user data without RLS restrictions.

import { createServiceClient } from '@/lib/supabase/server'
import type { UserRow } from '@/types/database'

// ── TwiML helper ─────────────────────────────────────────────────────────────
function twimlResponse(message: string) {
  // Escape XML special chars in any user-generated content
  const safe = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  )
}

// ── Reply copy ────────────────────────────────────────────────────────────────
function composeReply(friends: Pick<UserRow, 'display_name' | 'status_note'>[]): string {
  if (friends.length === 0) {
    return "Nobody's free right now. You could be first, open Mooves to go green."
  }

  const format = (f: typeof friends[number]) =>
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
  const from = formData.get('From') as string | null

  if (!from) {
    return twimlResponse("Couldn't process that. Try again in a moment.")
  }

  const supabase = createServiceClient()

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

  // 4. Filter: only friends whose visible_to includes sender (or is null = everyone)
  const visible = greenFriends.filter(f =>
    f.visible_to === null || (Array.isArray(f.visible_to) && f.visible_to.includes(sender.id))
  )

  return twimlResponse(composeReply(visible))
}
