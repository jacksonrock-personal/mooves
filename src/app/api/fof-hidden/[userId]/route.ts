// R29 — POST/DELETE /api/fof-hidden/[userId]: stop (or resume) seeing Mooves a
// particular person opens one hop out.
//
// THE PRESSURE VALVE, and it is load-bearing rather than a nicety. Mooves has
// no blocking. Unfriending is real and works, but it is unavailable here BY
// DEFINITION — you were never friends with this person, which is the whole
// reason their Moove needed a vouch to reach you. Without this route the only
// escape from one person is the global switch, which turns the feature off
// wholesale, or unfriending the bridge, which punishes somebody who did nothing.
//
// One-directional, and no notification, ever. Hiding someone is a fact about
// what you want to see, not a fact about them, so there is no second row to
// keep in sync and nothing to tell them. That is also why this is not "block":
// it removes their Mooves from your feed and does nothing else. They can still
// be brought over by a friend, still appear in a roster, still become your
// friend later — at which point their Mooves reach you as a friend's would,
// because the first-degree arm of get_plans does not consult this table.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit, tooManyRequests } from '@/lib/ratelimit'

type Params = { params: Promise<{ userId: string }> }

export async function POST(req: Request, { params }: Params) {
  const viewerId = req.headers.get('x-user-id')
  if (!viewerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId: hiddenId } = await params
  if (hiddenId === viewerId) {
    return NextResponse.json({ error: 'Cannot hide yourself' }, { status: 400 })
  }

  // A floor against a stuck client, not an engagement throttle.
  if (!(await checkRateLimit(`fof:hide:${viewerId}`, 60, 3600))) return tooManyRequests()

  const supabase = createServiceClient()

  // Idempotent on the composite PK, so a double tap is a no-op rather than a
  // 409 the sheet would have to explain.
  const { error } = await supabase
    .from('fof_hidden')
    .upsert({ user_id: viewerId, hidden_user_id: hiddenId }, { onConflict: 'user_id,hidden_user_id' })

  if (error) {
    console.error('fof hide failed:', error)
    return NextResponse.json({ error: 'Could not do that' }, { status: 500 })
  }

  return new Response(null, { status: 204 })
}

export async function DELETE(req: Request, { params }: Params) {
  const viewerId = req.headers.get('x-user-id')
  if (!viewerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId: hiddenId } = await params
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('fof_hidden')
    .delete()
    .eq('user_id', viewerId)
    .eq('hidden_user_id', hiddenId)

  if (error) {
    console.error('fof unhide failed:', error)
    return NextResponse.json({ error: 'Could not do that' }, { status: 500 })
  }

  return new Response(null, { status: 204 })
}
