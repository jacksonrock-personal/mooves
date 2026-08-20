// R31
// GET /api/friend-requests — what is waiting on you, and what you have sent.
//
// Both directions in one call, because the Friends panel renders both and two
// round trips for one screen is two chances for it to render half-updated.
//
// `sent` exists so a suggestion you have already asked can render as "Asked"
// rather than silently vanishing. A request that disappears on tap leaves you
// unsure it sent, and the one thing a request must never be is ambiguous.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface IncomingRequest {
  id: string
  fromId: string
  displayName: string | null
  avatarUrl: string | null
  /** Why they are reaching you — the same two reasons the suggestions carry. */
  mutualNames: string[]
  mutualCount: number
  createdAt: string
}

export async function GET(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const [{ data: incoming }, { data: sent }] = await Promise.all([
    supabase
      .from('friend_requests')
      .select('id, requester_id, created_at, users:requester_id (display_name, avatar_url)')
      .eq('recipient_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase
      .from('friend_requests')
      .select('recipient_id')
      .eq('requester_id', userId)
      .eq('status', 'pending'),
  ])

  type Row = {
    id: string
    requester_id: string
    created_at: string
    users: { display_name: string | null; avatar_url: string | null } | null
  }
  const rows = (incoming ?? []) as unknown as Row[]

  // The mutual friends BETWEEN the viewer and each requester, so an incoming
  // request can say why this person is reaching you. Someone with no explanation
  // attached is indistinguishable from a stranger, which is the state this whole
  // release exists to avoid.
  const requesterIds = rows.map(r => r.requester_id)
  const mutuals = new Map<string, string[]>()

  if (requesterIds.length > 0) {
    const { data: myFriends } = await supabase
      .from('friendships')
      .select('friend_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    const myIds = (myFriends ?? []).map(f => f.friend_id)
    if (myIds.length > 0) {
      const { data: theirs } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .in('user_id', myIds)
        .in('friend_id', requesterIds)

      const names = new Map<string, string | null>()
      const { data: profiles } = await supabase
        .from('users')
        .select('id, display_name')
        .in('id', myIds)
      for (const p of profiles ?? []) names.set(p.id, p.display_name)

      // myIds is already ordered longest-friendship-first, so pushing in that
      // order names the bridges you have known longest — R29's rule.
      for (const bridgeId of myIds) {
        for (const t of theirs ?? []) {
          if (t.user_id !== bridgeId) continue
          const list = mutuals.get(t.friend_id) ?? []
          const name = names.get(bridgeId)
          if (name) list.push(name)
          mutuals.set(t.friend_id, list)
        }
      }
    }
  }

  const requests: IncomingRequest[] = rows.map(r => {
    const all = mutuals.get(r.requester_id) ?? []
    return {
      id: r.id,
      fromId: r.requester_id,
      displayName: r.users?.display_name ?? null,
      avatarUrl: r.users?.avatar_url ?? null,
      mutualNames: all.slice(0, 3),
      mutualCount: all.length,
      createdAt: r.created_at,
    }
  })

  return NextResponse.json({
    requests,
    sentTo: (sent ?? []).map(s => s.recipient_id),
  })
}
