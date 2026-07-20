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

  const { data: move } = await supabase
    .from('sponsored_moves')
    .select('id, clicks, link_url')
    .eq('id', id)
    .single()
  if (!move) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await supabase.from('sponsored_moves').update({ clicks: move.clicks + 1 }).eq('id', id)

  return NextResponse.json({ linkUrl: move.link_url })
}
