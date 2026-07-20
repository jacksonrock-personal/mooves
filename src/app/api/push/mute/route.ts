// Phase 15 Surface B — per-group notification mute.
// GET  ?groupId=… → { muted } for the authed user.
// POST { groupId, muted } → set/clear the mute (row present = muted).

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const groupId = new URL(req.url).searchParams.get('groupId')
  if (!groupId) return NextResponse.json({ error: 'groupId required' }, { status: 400 })

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('group_notification_mutes')
    .select('group_id')
    .eq('user_id', userId)
    .eq('group_id', groupId)
    .maybeSingle()

  return NextResponse.json({ muted: !!data })
}

export async function POST(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { groupId?: unknown; muted?: unknown }
  try {
    body = (await req.json()) as { groupId?: unknown; muted?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  if (typeof body.groupId !== 'string' || typeof body.muted !== 'boolean') {
    return NextResponse.json({ error: 'groupId + muted required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  if (body.muted) {
    await supabase
      .from('group_notification_mutes')
      .upsert({ user_id: userId, group_id: body.groupId }, { onConflict: 'user_id,group_id' })
  } else {
    await supabase
      .from('group_notification_mutes')
      .delete()
      .eq('user_id', userId)
      .eq('group_id', body.groupId)
  }
  return NextResponse.json({ muted: body.muted })
}
