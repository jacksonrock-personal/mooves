// Phase 19.1
// POST /api/roundup-invite/[code]/join — auth required (middleware supplies
// x-user-id; this path is deliberately NOT public).
//
// Delegates to the roundup_join RPC, which does the cap check, the membership
// write and the mutual friend fan-out in ONE locked transaction. That has to be
// atomic: two people scanning at the same moment could otherwise both read 24
// and both get in. The RPC also records exactly which friendships it created,
// which is what makes Undo precise.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit, clientIp, tooManyRequests } from '@/lib/ratelimit'

type JoinStatus = 'joined' | 'already' | 'full' | 'expired' | 'invalid'

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await params

  // Two limits: per-user for ordinary abuse, per-IP because guessing a live code
  // is the one attack that would matter here.
  const [userOk, ipOk] = await Promise.all([
    checkRateLimit(`roundup:join:${userId}`, 20, 300),
    checkRateLimit(`roundup:join:ip:${clientIp(req)}`, 40, 300),
  ])
  if (!userOk || !ipOk) return tooManyRequests()

  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('roundup_join', { p_code: code, p_user: userId })

  if (error) {
    console.error('roundup_join failed:', error)
    return NextResponse.json({ error: 'Join failed' }, { status: 500 })
  }

  const row = (data as { status: JoinStatus; member_count: number; connected_count: number }[])?.[0]
  if (!row) return NextResponse.json({ status: 'invalid' as JoinStatus }, { status: 404 })

  // connected_count is how many people you were linked to. Some of those may
  // already have been friends, which is fine — the number describes the room.
  return NextResponse.json({
    status: row.status,
    memberCount: row.member_count,
    connectedCount: row.connected_count,
  })
}
