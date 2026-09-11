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

  // R33 — make sure something actually seeds where this person just said they are.
  //
  // Discover matches moves by zip radius, and moves only exist for zips some
  // metro claims. Until now the only thing that created metros was somebody
  // remembering to run scripts/seed-metros.mjs by hand. It went five weeks
  // un-run, and every user who set an area in that window — Princeton TX,
  // Hailey ID — got a permanently empty feed with no error anywhere to explain
  // it. A metro list maintained by memory is a metro list that goes stale.
  //
  // BEST-EFFORT, DELIBERATELY. The area write above is what the user actually
  // asked for and it has already committed. Failing the request now would throw
  // away the area they just set in exchange for a feed that would have filled
  // tomorrow — strictly worse. It logs, and seed-metros.mjs remains the net.
  try {
    const { error: metroError } = await supabase.rpc('ensure_metro_for_zip', { p_zip: area.zip })
    if (metroError) console.error('ensure_metro_for_zip failed for', area.zip, metroError)
  } catch (e) {
    console.error('ensure_metro_for_zip threw for', area.zip, e)
  }

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
