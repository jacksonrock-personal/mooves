// R36
// POST /api/plans/[id]/photos/added — "I've finished adding this batch".
//
// The client calls this once when a selection of uploads settles with at least
// one success. That is what turns six confirms into ONE push reading "added 6
// photos" rather than a push for the first photo and silence for the rest.
// The push itself enforces ≤ 1 per Moove per recipient per hour and never goes
// to the uploader; this route adds nothing but the access gate.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit, tooManyRequests } from '@/lib/ratelimit'
import { canAccessAlbum } from '@/lib/photos'
import { sendPhotosAddedPush } from '@/lib/push'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!(await checkRateLimit(`photos:added:${userId}`, 60, 3600))) return tooManyRequests()

  const supabase = createServiceClient()
  if (!(await canAccessAlbum(supabase, id, userId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Never allowed to fail the request, same as every other push in the app.
  try {
    await sendPhotosAddedPush(id, userId)
  } catch {
    // best effort
  }
  return NextResponse.json({ ok: true })
}
