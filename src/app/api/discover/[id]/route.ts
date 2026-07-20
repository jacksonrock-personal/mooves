// GET /api/discover/[id] — a single approved sponsored move summary, used to
// pre-anchor the go-green sheet when arriving at /feed?anchor=<id> (13.8).

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const supabase = createServiceClient()
  const { data: m } = await supabase
    .from('sponsored_moves')
    .select('id, title, description, category, brand, time_text, link_url')
    .eq('id', id)
    .eq('status', 'approved')
    .maybeSingle()

  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    id: m.id,
    title: m.title,
    description: m.description,
    category: m.category,
    brand: m.brand,
    timeText: m.time_text,
    linkUrl: m.link_url,
  })
}
