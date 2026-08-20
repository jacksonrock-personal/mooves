// R31 — GET /api/friend-suggestions: people you might know.
//
// A thin wrapper over `friend_suggestions(viewer)`. Everything that decides who
// appears — second degree or co-attendance, the suggestable flag, requests in
// either direction, fof_hidden, the cap and the ordering — lives in the SQL, in
// one place, alongside the rows it filters. That is the same reason R25 put
// can_see_week in the database rather than in a route: a visibility rule that
// travels separately from its data is a rule somebody eventually forgets to
// apply.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface FriendSuggestion {
  id: string
  displayName: string | null
  avatarUrl: string | null
  /** 'coAttended' outranks 'mutualFriends' — evidence beats inference. */
  reason: 'coAttended' | 'mutualFriends'
  /** The Moove you were both at. Present only on a coAttended suggestion. */
  coPlanTitle: string | null
  mutualNames: string[]
  mutualCount: number
}

export async function GET(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('friend_suggestions', { viewer: userId })

  if (error) {
    console.error('friend suggestions failed:', error)
    // An empty list, not a 500. Suggestions are the least important thing on the
    // People tab and must never be what stops it rendering your actual friends.
    return NextResponse.json({ suggestions: [] })
  }

  const suggestions: FriendSuggestion[] = (data ?? []).map(r => ({
    id: r.id,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
    reason: r.reason === 'coAttended' ? 'coAttended' : 'mutualFriends',
    coPlanTitle: r.co_plan_title,
    mutualNames: r.mutual_names ?? [],
    mutualCount: r.mutual_count ?? 0,
  }))

  return NextResponse.json({ suggestions })
}
