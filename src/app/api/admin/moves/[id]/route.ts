// PATCH /api/admin/moves/[id] — approve / reject-with-reason / edit fields.
// Admin-gated.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin'
import { INTEREST_SLUGS } from '@/lib/interests'

type Params = { params: Promise<{ id: string }> }

type MoveUpdate = {
  title?: string
  description?: string
  category?: string
  brand?: string | null
  area_zip?: string
  radius_miles?: number
  link_url?: string | null
  image_url?: string | null
  time_text?: string | null
  status?: string
  reject_reason?: string | null
}

export async function PATCH(req: Request, { params }: Params) {
  const userId = req.headers.get('x-user-id')
  if (!(await requireAdmin(userId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params

  const body = (await req.json()) as {
    action?: 'approve' | 'reject'
    rejectReason?: string
    title?: string
    description?: string
    category?: string
    brand?: string | null
    areaZip?: string
    radiusMiles?: number
    linkUrl?: string | null
    imageUrl?: string | null
    timeText?: string | null
  }

  const updates: MoveUpdate = {}

  if (body.action === 'approve') {
    updates.status = 'approved'
    updates.reject_reason = null
  } else if (body.action === 'reject') {
    const reason = body.rejectReason?.trim()
    if (!reason) return NextResponse.json({ error: 'Reject reason required' }, { status: 400 })
    updates.status = 'rejected'
    updates.reject_reason = reason
  }

  // Optional field edits.
  if (body.title !== undefined) {
    const t = body.title.trim()
    if (!t) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
    updates.title = t
  }
  if (body.description !== undefined) {
    const d = body.description.trim()
    if (!d) return NextResponse.json({ error: 'Description cannot be empty' }, { status: 400 })
    updates.description = d
  }
  if (body.category !== undefined) {
    if (!INTEREST_SLUGS.includes(body.category)) return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    updates.category = body.category
  }
  if (body.areaZip !== undefined) {
    if (!/^\d{5}$/.test(body.areaZip.trim())) return NextResponse.json({ error: 'Area ZIP must be 5 digits' }, { status: 400 })
    updates.area_zip = body.areaZip.trim()
  }
  if (body.radiusMiles !== undefined && body.radiusMiles > 0) updates.radius_miles = Math.round(body.radiusMiles)
  if (body.brand !== undefined) updates.brand = body.brand?.trim() || null
  if (body.linkUrl !== undefined) updates.link_url = body.linkUrl?.trim() || null
  if (body.imageUrl !== undefined) updates.image_url = body.imageUrl?.trim() || null
  if (body.timeText !== undefined) updates.time_text = body.timeText?.trim() || null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('sponsored_moves')
    .update(updates)
    .eq('id', id)
    .select('id, status, reject_reason')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  return NextResponse.json({ id: data.id, status: data.status, rejectReason: data.reject_reason })
}
