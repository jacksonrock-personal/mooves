// Phase 19.1
// POST /api/roundup-invite/[code]/undo — offered once, on the post-join
// confirmation, and nowhere else.
//
// Without it, scanning the wrong code costs up to 25 separate unfriends. The
// roundup_undo RPC removes ONLY the friendships that this join created (tracked
// in roundup_members.new_friend_ids) and never one the user already had, then
// drops their membership so later joiners no longer connect to them.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit, tooManyRequests } from '@/lib/ratelimit'

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await checkRateLimit(`roundup:undo:${userId}`, 10, 300))) return tooManyRequests()

  const { code } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('roundup_undo', { p_code: code, p_user: userId })
  if (error) {
    console.error('roundup_undo failed:', error)
    return NextResponse.json({ error: 'Undo failed' }, { status: 500 })
  }

  return NextResponse.json({ removedCount: (data as number) ?? 0 })
}
