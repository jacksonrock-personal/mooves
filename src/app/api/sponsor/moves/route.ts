// GET  /api/sponsor/moves — the sponsor's own moves + aggregate analytics
// POST /api/sponsor/moves — author a move → enters the moderation queue (pending)
// Sponsor-gated. Analytics honor small-N suppression (counts 1–4 hidden).

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireSponsor } from '@/lib/sponsor'
import { INTEREST_SLUGS } from '@/lib/interests'
import type { Database } from '@/types/database'

type MoveRow = Database['public']['Tables']['sponsored_moves']['Row']

// Small-N suppression (guardrail): 0 shows as 0; 1–4 hidden (null → "<5"); >=5 shown.
function suppress(n: number): number | null {
  return n === 0 ? 0 : n < 5 ? null : n
}

// Billing state for an approved move: live (paid) · failed (charge attempted,
// unpaid) · awaiting (no card yet). Null for pending/rejected.
function billingState(m: MoveRow): 'live' | 'failed' | 'awaiting' | null {
  if (m.status !== 'approved') return null
  if (m.paid_at) return 'live'
  return m.stripe_payment_intent_id ? 'failed' : 'awaiting'
}

function mapSponsorMove(m: MoveRow) {
  const billing = billingState(m)
  const live = billing === 'live'
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
    billing, // 'live' | 'failed' | 'awaiting' | null
    priceCents: m.price_cents,
    paidAt: m.paid_at,
    rejectReason: m.reject_reason,
    createdAt: m.created_at,
    // Analytics only meaningful once live (approved + paid); suppressed small-N.
    impressions: live ? suppress(m.impressions) : null,
    interested: live ? suppress(m.interested_count) : null,
    clicks: live ? suppress(m.clicks) : null,
    broughtOver: live ? suppress(m.brought_over_count) : null,
  }
}

export async function GET() {
  const sponsorId = await requireSponsor()
  if (!sponsorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('sponsored_moves')
    .select('*')
    .eq('sponsor_id', sponsorId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  return NextResponse.json({ moves: (data ?? []).map(mapSponsorMove) })
}

export async function POST(req: Request) {
  const sponsorId = await requireSponsor()
  if (!sponsorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  // Default the brand to the sponsor's business name.
  let brand = body.brand?.trim() || null
  if (!brand) {
    const { data: sponsor } = await supabase.from('sponsors').select('business_name').eq('id', sponsorId).single()
    brand = sponsor?.business_name ?? null
  }

  const { data, error } = await supabase
    .from('sponsored_moves')
    .insert({
      sponsor_id: sponsorId,
      title,
      description,
      category,
      brand,
      area_zip: areaZip,
      radius_miles: typeof body.radiusMiles === 'number' && body.radiusMiles > 0 ? Math.round(body.radiusMiles) : 25,
      link_url: body.linkUrl?.trim() || null,
      image_url: body.imageUrl?.trim() || null,
      time_text: body.timeText?.trim() || null,
      start_at: body.startAt ?? null,
      location_text: body.locationText?.trim() || null,
      status: 'pending', // sponsors never self-publish
    })
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Create failed' }, { status: 500 })
  return NextResponse.json(mapSponsorMove(data), { status: 201 })
}
