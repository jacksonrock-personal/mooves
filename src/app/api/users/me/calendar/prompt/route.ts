// R35 — the one-time first-join prompt.
//
// POST /api/users/me/calendar/prompt — "may I show it?", asked right after a
// join. Answers { show: true } AT MOST ONCE PER ACCOUNT, EVER, and spends it in
// the same statement: the write is conditional on calendar_prompted_at still
// being null, so two tabs racing each other cannot both win.
//
// The server also confirms there really is a Moove join on record. The client
// asks off the back of an optimistic "I'm in", and a join that failed must not
// spend the prompt. While that join is still in flight the answer is
// { show: false, retry: true } and nothing is written.
//
// Someone who already set up sync is never asked; their prompt is spent quietly.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: me } = await supabase
    .from('users')
    .select('calendar_token, calendar_prompted_at')
    .eq('id', userId)
    .maybeSingle()
  if (!me || me.calendar_prompted_at) return NextResponse.json({ show: false })

  const now = new Date().toISOString()

  if (me.calendar_token) {
    await supabase
      .from('users')
      .update({ calendar_prompted_at: now })
      .eq('id', userId)
      .is('calendar_prompted_at', null)
    return NextResponse.json({ show: false })
  }

  const { data: join } = await supabase
    .from('move_joins')
    .select('id')
    .eq('joiner_id', userId)
    .not('plan_id', 'is', null)
    .limit(1)
    .maybeSingle()
  if (!join) return NextResponse.json({ show: false, retry: true })

  const { data: spent } = await supabase
    .from('users')
    .update({ calendar_prompted_at: now })
    .eq('id', userId)
    .is('calendar_prompted_at', null)
    .select('id')
  return NextResponse.json({ show: (spent ?? []).length > 0 })
}
