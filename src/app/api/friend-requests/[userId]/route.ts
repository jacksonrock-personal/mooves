// R31 — POST /api/friend-requests/[userId]: ask to be someone's friend.
//
// THE REACHABILITY GUARD BELOW IS THE WHOLE SECURITY STORY OF THIS ROUTE.
//
// Without `can_request_friend`, this is a channel for reaching any user id in
// the database — and it would arrive wearing a consent step, which is exactly
// how it would go unnoticed in review. The only people you may ask are the ones
// you could already see a reason for: one hop out, or somebody you have been in
// a Moove with. Both carry an explanation a human can evaluate, which is what
// separates this from a directory.
//
// This route deliberately does NOT create a friendship. That happens only in
// /accept, and only on the recipient's tap.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit, tooManyRequests } from '@/lib/ratelimit'
import { sendFriendRequestPush } from '@/lib/push'

type Params = { params: Promise<{ userId: string }> }

export async function POST(req: Request, { params }: Params) {
  const requesterId = req.headers.get('x-user-id')
  if (!requesterId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId: recipientId } = await params

  // Not an engagement throttle — a floor against someone walking the graph.
  if (!(await checkRateLimit(`friendreq:${requesterId}`, 30, 3600))) return tooManyRequests()

  const supabase = createServiceClient()

  const { data: reachable } = await supabase.rpc('can_request_friend', {
    viewer: requesterId,
    target: recipientId,
  })
  if (!reachable) {
    // 403 with no detail: a caller probing ids learns nothing about whether the
    // person exists, is already a friend, or has asked not to be suggested.
    return NextResponse.json({ error: 'Not available' }, { status: 403 })
  }

  // A DECLINED row is permanent and blocks the re-ask, so this must not upsert
  // over it. Checking first also means an already-pending request answers 200
  // rather than erroring, which keeps a double tap harmless.
  const { data: existing } = await supabase
    .from('friend_requests')
    .select('id, status, requester_id')
    .or(
      `and(requester_id.eq.${requesterId},recipient_id.eq.${recipientId}),and(requester_id.eq.${recipientId},recipient_id.eq.${requesterId})`,
    )
    .maybeSingle()

  if (existing) {
    // CROSSING REQUESTS AUTO-ACCEPT. They asked, then you asked: both people
    // have consented, and making either tap again would be a bug wearing a
    // rule's clothing.
    if (existing.status === 'pending' && existing.requester_id === recipientId) {
      const { error: linkError } = await supabase.from('friendships').upsert(
        [
          { user_id: requesterId, friend_id: recipientId },
          { user_id: recipientId, friend_id: requesterId },
        ],
        { onConflict: 'user_id,friend_id', ignoreDuplicates: true },
      )
      if (linkError) {
        console.error('crossed friend request link failed:', linkError)
        return NextResponse.json({ error: 'Could not do that' }, { status: 500 })
      }
      await supabase
        .from('friend_requests')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', existing.id)
      return NextResponse.json({ status: 'accepted', crossed: true })
    }
    // Anything else — already pending from you, or declined — is a no-op that
    // reveals nothing about which.
    return NextResponse.json({ status: 'pending' })
  }

  const { error } = await supabase
    .from('friend_requests')
    .insert({ requester_id: requesterId, recipient_id: recipientId })

  if (error) {
    console.error('friend request insert failed:', error)
    return NextResponse.json({ error: 'Could not do that' }, { status: 500 })
  }

  // Best-effort, like every other push in the app: a mail failure must never
  // fail the write.
  try {
    await sendFriendRequestPush(recipientId, requesterId)
  } catch (e) {
    console.error('friend request push failed:', e)
  }

  return NextResponse.json({ status: 'pending' }, { status: 201 })
}
