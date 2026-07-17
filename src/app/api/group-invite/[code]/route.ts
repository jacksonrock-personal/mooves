// GET /api/group-invite/[code] — public: resolve a group invite link for the
// join landing (name, emoji, how many people you'd connect with). No auth.
// 404 → the landing renders the "invite no longer active" (dead-link) state.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const supabase = createServiceClient()

  const { data: group } = await supabase
    .from('groups')
    .select('id, name, emoji, owner_id, group_members(user_id)')
    .eq('invite_code', code)
    .maybeSingle()

  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // People the joiner would connect with = the owner + all current members.
  const connectSet = new Set<string>([group.owner_id, ...group.group_members.map(m => m.user_id)])

  return NextResponse.json(
    { name: group.name, emoji: group.emoji, memberCount: connectSet.size },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600' } },
  )
}
