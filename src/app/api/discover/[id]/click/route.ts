// POST /api/discover/[id]/click — record an aggregate click and return the
// sponsor link (13.3). Aggregate only; no user identity stored.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const supabase = createServiceClient()

  // Atomic increment + link fetch in one round trip. Empty result = move not found.
  const { data, error } = await supabase.rpc('record_move_click', { p_move_id: id })
  if (error) return NextResponse.json({ error: 'Click failed' }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ linkUrl: data[0].link_url })
}
