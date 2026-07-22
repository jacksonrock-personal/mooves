// POST   /api/discover/[id]/interested — mark interested (13.3)
// DELETE /api/discover/[id]/interested — unmark
// move_interested is the source of truth (dedupe + aggregate); interested_count
// is a best-effort counter. The sponsor never sees who — aggregate only.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const supabase = createServiceClient()

  const { data: move } = await supabase
    .from('sponsored_moves')
    .select('id')
    .eq('id', id)
    .single()
  if (!move) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // interested_count is maintained by the trg_interested_count trigger.
  const { data: existing } = await supabase
    .from('move_interested')
    .select('move_id')
    .eq('move_id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!existing) {
    await supabase.from('move_interested').insert({ move_id: id, user_id: userId })
  }

  return NextResponse.json({ interested: true })
}

export async function DELETE(req: Request, { params }: Params) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const supabase = createServiceClient()

  // interested_count is maintained by the trg_interested_count trigger, which only
  // fires when a row is actually deleted — so an unconditional delete is idempotent.
  await supabase.from('move_interested').delete().eq('move_id', id).eq('user_id', userId)

  return NextResponse.json({ interested: false })
}
