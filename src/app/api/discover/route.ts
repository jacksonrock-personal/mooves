// GET /api/discover — sponsored moves matching the viewer's coarse area
// (Phase 12 resolveArea → nearby-zip radius) AND their opted-in interests.
// Only approved moves. Records aggregate impressions. Never friend/stranger greens.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveArea } from '@/lib/geo'
import { INTEREST_SLUGS } from '@/lib/interests'

export async function GET(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: user } = await supabase
    .from('users')
    .select('area_zip, interests')
    .eq('id', userId)
    .single()

  const areaZip = user?.area_zip ?? null
  const interests = (user?.interests ?? []).filter(s => INTEREST_SLUGS.includes(s))

  if (!areaZip || interests.length === 0) {
    return NextResponse.json({
      needsSetup: true,
      hasArea: !!areaZip,
      hasInterests: interests.length > 0,
      moves: [],
    })
  }

  const match = await resolveArea(supabase, areaZip)
  const zips = match ? match.nearbyZips : [areaZip]

  // Live = moderation-approved AND (Mooves-authored OR paid). Sponsor-authored
  // moves only appear once their placement charge has cleared (13.6b).
  // Dated moves expire 3h after start (late joiners ok, stale events gone);
  // start_at NULL = evergreen (recurring events).
  const expiryFloor = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
  // 13.2a — soonest first; evergreen (start_at null) last, newest-created first.
  const { data: rows, error } = await supabase
    .from('sponsored_moves')
    .select('id, title, description, category, brand, time_text, link_url, image_url, start_at')
    .eq('status', 'approved')
    .in('area_zip', zips)
    .in('category', interests)
    .or('sponsor_id.is.null,paid_at.not.is.null')
    .or(`start_at.is.null,start_at.gt.${expiryFloor}`)
    .order('start_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 })

  const moves = rows ?? []

  // Which of these has the viewer already marked interested?
  let interestedIds = new Set<string>()
  if (moves.length > 0) {
    const { data: mine } = await supabase
      .from('move_interested')
      .select('move_id')
      .eq('user_id', userId)
      .in('move_id', moves.map(m => m.id))
    interestedIds = new Set((mine ?? []).map(r => r.move_id))
  }

  // Aggregate impressions — one atomic batch increment (race-free), fire-and-forget.
  // Never tied to a user identity.
  void supabase
    .rpc('increment_move_impressions', { move_ids: moves.map(m => m.id) })
    .then(({ error }) => {
      if (error) console.error('impressions increment failed:', error)
    })

  return NextResponse.json({
    needsSetup: false,
    hasArea: true,
    hasInterests: true,
    area: match
      ? { zip: match.zip, city: match.city, state: match.state }
      : { zip: areaZip, city: null, state: null },
    moves: moves.map(m => ({
      id: m.id,
      title: m.title,
      description: m.description,
      category: m.category,
      brand: m.brand,
      timeText: m.time_text,
      linkUrl: m.link_url,
      imageUrl: m.image_url,
      startAt: m.start_at,
      interestedByMe: interestedIds.has(m.id),
    })),
  })
}
