// PATCH /api/admin/moves/[id] — approve / reject / mark-reviewed / pull / edit.
// Admin-gated.
//
// R27 added two actions, and they are not synonyms for the two that existed:
//
//   reviewed — "I looked at this and it is fine." Stamps reviewed_at. Changes
//              NOTHING a user can see; the move was already live. This is the
//              whole of the post-hoc review pass.
//   pull     — "This is live and should not be." Rejects it with a reason, so
//              it disappears from the feed. The undo for auto-publish.
//
// approve still means "make this visible", which after R27 only sponsor moves
// need. Keeping them distinct matters: collapsing `reviewed` into `approve`
// would make clearing the audit list indistinguishable from publishing, and
// then the console could no longer tell you what has actually been checked.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin'
import { INTEREST_SLUGS } from '@/lib/interests'
import { chargeForPlacement } from '@/lib/billing'

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
  start_at?: string | null
  location_text?: string | null
  status?: string
  reject_reason?: string | null
  reviewed_at?: string | null
}

export async function PATCH(req: Request, { params }: Params) {
  const userId = req.headers.get('x-user-id')
  if (!(await requireAdmin(userId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params

  const body = (await req.json()) as {
    action?: 'approve' | 'reject' | 'reviewed' | 'pull'
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
    startAt?: string | null
    locationText?: string | null
  }

  const updates: MoveUpdate = {}

  if (body.action === 'approve') {
    updates.status = 'approved'
    updates.reject_reason = null
    // A human deciding to publish has by definition reviewed it.
    updates.reviewed_at = new Date().toISOString()
  } else if (body.action === 'reject' || body.action === 'pull') {
    const reason = body.rejectReason?.trim()
    if (!reason) return NextResponse.json({ error: 'Reject reason required' }, { status: 400 })
    updates.status = 'rejected'
    updates.reject_reason = reason
    updates.reviewed_at = new Date().toISOString()
  } else if (body.action === 'reviewed') {
    // Visibility untouched on purpose — see the header.
    updates.reviewed_at = new Date().toISOString()
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
  if (body.startAt !== undefined) updates.start_at = body.startAt
  if (body.locationText !== undefined) updates.location_text = body.locationText?.trim() || null

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

  // On approval, attempt the placement charge. Sponsor-authored moves go live
  // only once paid; if there's no card on file yet, the move waits (13.6b).
  let billing: string | undefined
  if (updates.status === 'approved') {
    billing = await chargeForPlacement(id)
  }

  return NextResponse.json({ id: data.id, status: data.status, rejectReason: data.reject_reason, billing })
}
