// GET  /api/groups/[id]/invite — owner: get (lazily create) the group's invite link
// POST /api/groups/[id]/invite — owner: reset the link (revoke old, issue new)
//
// Phase 10.2. Owner-scoped (Option A): only the group owner manages the link.
// Joining via the link adds the joiner to the group AND auto-friends all members.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateReferralCode } from '@/lib/referral'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Params = { params: Promise<{ id: string }> }

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://makemooves.app'
const inviteUrl = (code: string) => `${APP_URL}/g/${code}`

// Assigns a fresh unique invite_code to the group, retrying on the rare collision.
async function setUniqueCode(
  supabase: SupabaseClient<Database>,
  groupId: string,
): Promise<string | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode()
    const { error } = await supabase.from('groups').update({ invite_code: code }).eq('id', groupId)
    if (!error) return code
    if (error.code !== '23505') return null // not a uniqueness collision — real failure
  }
  return null
}

async function requireOwnedGroup(supabase: SupabaseClient<Database>, id: string, userId: string) {
  const { data } = await supabase
    .from('groups')
    .select('id, invite_code')
    .eq('id', id)
    .eq('owner_id', userId)
    .maybeSingle()
  return data
}

export async function GET(req: Request, { params }: Params) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()
  const group = await requireOwnedGroup(supabase, id, userId)
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let code = group.invite_code
  if (!code) {
    code = await setUniqueCode(supabase, id)
    if (!code) return NextResponse.json({ error: 'Could not create link' }, { status: 500 })
  }
  return NextResponse.json({ code, url: inviteUrl(code) })
}

export async function POST(req: Request, { params }: Params) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()
  const group = await requireOwnedGroup(supabase, id, userId)
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const code = await setUniqueCode(supabase, id)
  if (!code) return NextResponse.json({ error: 'Could not reset link' }, { status: 500 })
  return NextResponse.json({ code, url: inviteUrl(code) })
}
