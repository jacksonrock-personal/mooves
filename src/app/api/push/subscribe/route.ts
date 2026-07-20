// Phase 15 Surface B — push subscription storage.
// POST   { fcmToken, platform? } → upsert the token for the authed user.
// DELETE { fcmToken }            → remove the token (opt-out / sign-out).

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { fcmToken?: unknown; platform?: unknown }
  try {
    body = (await req.json()) as { fcmToken?: unknown; platform?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  if (typeof body.fcmToken !== 'string' || !body.fcmToken) {
    return NextResponse.json({ error: 'fcmToken required' }, { status: 400 })
  }
  const platform = typeof body.platform === 'string' ? body.platform.slice(0, 20) : null

  const supabase = createServiceClient()
  // Token is globally unique; upsert re-homes it to this user + refreshes last_seen.
  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: userId, fcm_token: body.fcmToken, platform, last_seen_at: new Date().toISOString() },
    { onConflict: 'fcm_token' },
  )
  if (error) return NextResponse.json({ error: 'Could not save' }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { fcmToken?: unknown }
  try {
    body = (await req.json()) as { fcmToken?: unknown }
  } catch {
    body = {}
  }

  const supabase = createServiceClient()
  const query = supabase.from('push_subscriptions').delete().eq('user_id', userId)
  // Delete just this device's token if provided, else all of the user's tokens.
  if (typeof body.fcmToken === 'string' && body.fcmToken) {
    await query.eq('fcm_token', body.fcmToken)
  } else {
    await query
  }
  return NextResponse.json({ ok: true })
}
