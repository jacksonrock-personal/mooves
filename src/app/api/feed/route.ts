// GET /api/feed — green friends visible to the current user (visibility-filtered),
// each with their presence (joiners), plus the viewer's own move joiners and the
// ambient signals. All assembled in one Postgres function (get_feed, migration
// 0005) so this hot path is a single round trip instead of ~7 sequential queries.
// The returned JSON shape is unchanged: { friends, myJoiners, ambient }.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const EMPTY_FEED = { friends: [], myJoiners: [], ambient: { activeNow: 0, recentGreen: 0 } }

export async function GET(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('get_feed', { viewer: userId })
  if (error) {
    console.error('get_feed failed:', error.message)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  return NextResponse.json(data ?? EMPTY_FEED)
}
