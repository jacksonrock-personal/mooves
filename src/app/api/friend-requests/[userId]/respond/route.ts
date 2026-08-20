// R31 — POST /api/friend-requests/[userId]/respond: accept or decline.
//
// `userId` is the REQUESTER — the person who asked you — not a request id. Two
// reasons, and the second is the one that matters:
//
//   · the segment then means the same thing everywhere under this route ("the
//     other person"), and Next.js will not accept two different slug names as
//     siblings anyway;
//   · the client never has to hold a request id, so there is no id for it to
//     get stale, confuse across a refetch, or leak. UNIQUE(requester_id,
//     recipient_id) makes "the pending request from this person" unambiguous.
//
// One route, not two, because accept and decline share every check that matters
// — it is yours to answer, and it is still pending — and differ only in what
// they write. Two routes would be two places to forget the gate.
//
// ACCEPT writes both friendship rows and THEN marks the request. If the second
// write failed you would have a real friendship with a stale pending request,
// which every reader already tolerates: friend_suggestions excludes anyone you
// are friends with before it ever looks at requests. The other order would
// leave an accepted request and no friendship — somebody who tapped accept and
// got nothing.
//
// DECLINE writes the status and NOTHING else. No push, no signal, no trace the
// requester can observe. The row persists forever, and that permanence is what
// removes the declined person from their suggestions for good.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit, tooManyRequests } from '@/lib/ratelimit'
import { sendFriendAcceptedPush } from '@/lib/push'

type Params = { params: Promise<{ userId: string }> }

export async function POST(req: Request, { params }: Params) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId: requesterId } = await params
  if (!(await checkRateLimit(`friendreq:respond:${userId}`, 60, 3600))) return tooManyRequests()

  const body = (await req.json()) as { action?: 'accept' | 'decline' }
  if (body.action !== 'accept' && body.action !== 'decline') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Only the RECIPIENT may answer, and only while it is pending. Matching both
  // in the read means a requester trying to accept their own request gets the
  // same 404 as a stranger guessing.
  const { data: request } = await supabase
    .from('friend_requests')
    .select('id, requester_id, recipient_id, status')
    .eq('requester_id', requesterId)
    .eq('recipient_id', userId)
    .eq('status', 'pending')
    .maybeSingle()

  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const respondedAt = new Date().toISOString()

  if (body.action === 'decline') {
    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'declined', responded_at: respondedAt })
      .eq('id', request.id)
    if (error) {
      console.error('decline failed:', error)
      return NextResponse.json({ error: 'Could not do that' }, { status: 500 })
    }
    return new Response(null, { status: 204 })
  }

  const { error: linkError } = await supabase.from('friendships').upsert(
    [
      { user_id: request.requester_id, friend_id: request.recipient_id },
      { user_id: request.recipient_id, friend_id: request.requester_id },
    ],
    { onConflict: 'user_id,friend_id', ignoreDuplicates: true },
  )
  if (linkError) {
    console.error('accept link failed:', linkError)
    return NextResponse.json({ error: 'Could not do that' }, { status: 500 })
  }

  const { error } = await supabase
    .from('friend_requests')
    .update({ status: 'accepted', responded_at: respondedAt })
    .eq('id', request.id)
  if (error) console.error('accept status update failed (friendship exists):', error)

  // The requester has to be told, or their request just quietly becomes a
  // friendship they are left to notice on their own.
  try {
    await sendFriendAcceptedPush(request.requester_id, request.recipient_id)
  } catch (e) {
    console.error('accept push failed:', e)
  }

  return NextResponse.json({ status: 'accepted' })
}
