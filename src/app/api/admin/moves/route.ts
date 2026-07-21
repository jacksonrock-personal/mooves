// GET  /api/admin/moves?status=pending|approved|rejected|all — list moves (admin)
// POST /api/admin/moves — author a move (concierge). publish:true → approved.
// Admin-gated via requireAdmin; never trust a client admin claim.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin'
import { INTEREST_SLUGS } from '@/lib/interests'
import type { Database } from '@/types/database'

type MoveRow = Database['public']['Tables']['sponsored_moves']['Row']

function mapMove(m: MoveRow) {
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    category: m.category,
    brand: m.brand,
    areaZip: m.area_zip,
    radiusMiles: m.radius_miles,
    linkUrl: m.link_url,
    imageUrl: m.image_url,
    timeText: m.time_text,
    startAt: m.start_at,
    locationText: m.location_text,
    status: m.status,
    rejectReason: m.reject_reason,
    sponsorId: m.sponsor_id,
    impressions: m.impressions,
    clicks: m.clicks,
    interestedCount: m.interested_count,
    broughtOverCount: m.brought_over_count,
    createdAt: m.created_at,
  }
}

export async function GET(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!(await requireAdmin(userId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const status = new URL(req.url).searchParams.get('status') ?? 'all'
  const supabase = createServiceClient()

  let query = supabase.from('sponsored_moves').select('*').order('created_at', { ascending: false })
  if (['pending', 'approved', 'rejected'].includes(status)) {
    query = query.eq('status', status)
  }
  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 })

  const { count: pendingCount } = await supabase
    .from('sponsored_moves')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  return NextResponse.json({
    moves: (data ?? []).map(mapMove),
    pendingCount: pendingCount ?? 0,
  })
}

export async function POST(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!(await requireAdmin(userId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await req.json()) as {
    title?: string
    description?: string
    category?: string
    brand?: string | null
    areaZip?: string
    radiusMiles?: number
    linkUrl?: string | null
    imageUrl?: string | null
    timeText?: string | null
    startAt?: string | null
    locationText?: string | null
    publish?: boolean
  }

  const title = body.title?.trim() ?? ''
  const description = body.description?.trim() ?? ''
  const category = body.category ?? ''
  const areaZip = body.areaZip?.trim() ?? ''

  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 })
  if (!description) return NextResponse.json({ error: 'Description required' }, { status: 400 })
  if (!INTEREST_SLUGS.includes(category)) return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  if (!/^\d{5}$/.test(areaZip)) return NextResponse.json({ error: 'Area ZIP must be 5 digits' }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('sponsored_moves')
    .insert({
      title,
      description,
      category,
      brand: body.brand?.trim() || null,
      area_zip: areaZip,
      radius_miles: typeof body.radiusMiles === 'number' && body.radiusMiles > 0 ? Math.round(body.radiusMiles) : 25,
      link_url: body.linkUrl?.trim() || null,
      image_url: body.imageUrl?.trim() || null,
      time_text: body.timeText?.trim() || null,
      start_at: body.startAt ?? null,
      location_text: body.locationText?.trim() || null,
      status: body.publish ? 'approved' : 'pending',
    })
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Create failed' }, { status: 500 })
  return NextResponse.json(mapMove(data), { status: 201 })
}
