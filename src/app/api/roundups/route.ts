// Phase 19.1
// POST /api/roundups — open a session ("Add everyone here"). Returns the code +
//                      link + roster. Closes any stale open session first.
// GET  /api/roundups  — the caller's currently-open session, or null.
//
// A session creates NO group. The only thing that survives it is friendships.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit, tooManyRequests } from '@/lib/ratelimit'
import {
  generateRoundupCode,
  roundupUrl,
  ROUNDUP_TTL_HOURS,
  type RoundupMember,
  type RoundupSessionData,
} from '@/lib/roundup'

type SupabaseClient = ReturnType<typeof createServiceClient>

/** Roster for a session, host first, then join order. */
async function loadMembers(
  supabase: SupabaseClient,
  roundupId: string,
  hostId: string,
): Promise<RoundupMember[]> {
  const { data } = await supabase
    .from('roundup_members')
    .select('user_id, joined_at, users(display_name, avatar_url)')
    .eq('roundup_id', roundupId)
    .order('joined_at', { ascending: true })

  const rows = (data ?? []) as unknown as {
    user_id: string
    joined_at: string
    users: { display_name: string | null; avatar_url: string | null } | null
  }[]

  return rows
    .map(r => ({
      id: r.user_id,
      displayName: r.users?.display_name ?? null,
      avatarUrl: r.users?.avatar_url ?? null,
      isHost: r.user_id === hostId,
      joinedAt: r.joined_at,
    }))
    .sort((a, b) => (a.isHost === b.isHost ? 0 : a.isHost ? -1 : 1))
}

export async function GET(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: roundup } = await supabase
    .from('roundups')
    .select('id, code, expires_at')
    .eq('host_id', userId)
    .is('closed_at', null)
    .maybeSingle()

  if (!roundup) return NextResponse.json({ session: null, expired: null })

  const members = await loadMembers(supabase, roundup.id, userId)

  // Lazily retire a session that ran out while the host was away, and tell them
  // it happened. Silently dropping them back on the hub would leave the "that
  // code expired" state unreachable, and would not reassure them that the
  // friendships survived — which is the only thing the session was ever for.
  if (new Date(roundup.expires_at) <= new Date()) {
    await supabase
      .from('roundups')
      .update({ closed_at: new Date().toISOString() })
      .eq('id', roundup.id)
    return NextResponse.json({
      session: null,
      expired: { joinedCount: Math.max(members.length - 1, 0) },
    })
  }

  const session: RoundupSessionData = {
    id: roundup.id,
    code: roundup.code,
    url: roundupUrl(roundup.code),
    expiresAt: roundup.expires_at,
    members,
  }
  return NextResponse.json({ session, expired: null })
}

export async function POST(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Opening sessions is cheap for us and noisy if scripted — throttle it.
  if (!(await checkRateLimit(`roundup:start:${userId}`, 10, 3600))) return tooManyRequests()

  const supabase = createServiceClient()

  // "One open session per host" is enforced by a partial unique index. Close any
  // stale one first, otherwise a host whose last session simply timed out would
  // be permanently blocked from opening another.
  await supabase
    .from('roundups')
    .update({ closed_at: new Date().toISOString() })
    .eq('host_id', userId)
    .is('closed_at', null)

  const expiresAt = new Date(Date.now() + ROUNDUP_TTL_HOURS * 3600 * 1000).toISOString()

  // Retry on the (vanishingly unlikely) code collision.
  let created: { id: string; code: string; expires_at: string } | null = null
  for (let attempt = 0; attempt < 3 && !created; attempt++) {
    const code = generateRoundupCode()
    const { data, error } = await supabase
      .from('roundups')
      .insert({ code, host_id: userId, expires_at: expiresAt })
      .select('id, code, expires_at')
      .single()
    if (data) created = data
    else if (error && error.code !== '23505') {
      console.error('roundup insert failed:', error)
      return NextResponse.json({ error: 'Could not start' }, { status: 500 })
    }
  }
  if (!created) return NextResponse.json({ error: 'Could not start' }, { status: 500 })

  // The host is a member of their own session: they count toward the cap, and
  // every joiner is friended to them.
  const { error: memberError } = await supabase
    .from('roundup_members')
    .insert({ roundup_id: created.id, user_id: userId })
  if (memberError) {
    console.error('roundup host membership failed:', memberError)
    return NextResponse.json({ error: 'Could not start' }, { status: 500 })
  }

  const members = await loadMembers(supabase, created.id, userId)
  const session: RoundupSessionData = {
    id: created.id,
    code: created.code,
    url: roundupUrl(created.code),
    expiresAt: created.expires_at,
    members,
  }
  return NextResponse.json({ session }, { status: 201 })
}
