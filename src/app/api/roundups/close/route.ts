// Phase 19.1
// POST /api/roundups/close — the host taps "Done". Stops the code working and
// returns how many people were added, for the confirmation state.
//
// Closing never touches friendships: they are the whole point, and they outlive
// the session by design.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: roundup } = await supabase
    .from('roundups')
    .select('id')
    .eq('host_id', userId)
    .is('closed_at', null)
    .maybeSingle()

  if (!roundup) return NextResponse.json({ closed: false, addedCount: 0 })

  // Everyone except the host — "You added 4 people" counts the people added.
  const { count } = await supabase
    .from('roundup_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('roundup_id', roundup.id)
    .neq('user_id', userId)

  const { error } = await supabase
    .from('roundups')
    .update({ closed_at: new Date().toISOString() })
    .eq('id', roundup.id)

  if (error) {
    console.error('roundup close failed:', error)
    return NextResponse.json({ error: 'Could not close' }, { status: 500 })
  }

  return NextResponse.json({ closed: true, addedCount: count ?? 0 })
}
