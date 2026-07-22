// POST   /api/users/area — set the coarse area from device coords (coarsened +
//                          discarded) OR a manual zip; writes users.area_zip.
// DELETE /api/users/area — clear the coarse area.
//
// Precise coordinates are NEVER persisted or logged. They are used only to
// derive the nearest zip in-memory (see coarsenToZip), then dropped. Only the
// coarse zip string is stored.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { coarsenToZip, lookupZip, type CoarseArea } from '@/lib/geo'

export async function POST(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json()) as { lat?: number; lng?: number; zip?: string }

  const supabase = createServiceClient()
  let area: CoarseArea | null = null

  if (typeof body.zip === 'string') {
    const zip = body.zip.trim()
    if (!/^\d{5}$/.test(zip)) {
      return NextResponse.json({ error: 'Invalid zip' }, { status: 422 })
    }
    area = await lookupZip(supabase, zip)
    if (!area) return NextResponse.json({ error: 'Unknown zip' }, { status: 422 })
  } else if (typeof body.lat === 'number' && typeof body.lng === 'number') {
    if (body.lat < -90 || body.lat > 90 || body.lng < -180 || body.lng > 180) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
    }
    area = await coarsenToZip(supabase, body.lat, body.lng)
    // body.lat / body.lng are intentionally never written or logged past here.
    if (!area) return NextResponse.json({ error: 'No area found' }, { status: 422 })
  } else {
    return NextResponse.json({ error: 'Provide lat/lng or zip' }, { status: 400 })
  }

  const { error } = await supabase
    .from('users')
    .update({ area_zip: area.zip })
    .eq('id', userId)

  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  return NextResponse.json(area)
}

export async function DELETE(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('users')
    .update({ area_zip: null })
    .eq('id', userId)

  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
