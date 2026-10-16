// R36
// POST /api/plans/[id]/photos/upload-url — a signed upload URL for one photo.
//
// Checks access (404 otherwise), the 30-day window and the per-person cap
// before minting anything. The path embeds the caller's id —
// `${planId}/${userId}/${uuid}.jpg` — so the confirm step can tell an object
// this caller was issued from one somebody else uploaded.
//
// The cap is checked here AND re-checked on confirm: a client can ask for many
// URLs at once, and only the confirm is authoritative.

import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit, tooManyRequests } from '@/lib/ratelimit'
import { PHOTO_BUCKET, PHOTO_CAP_PER_PERSON, albumIsOpen, canAccessAlbum } from '@/lib/photos'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!(await checkRateLimit(`photos:upload:${userId}`, 300, 3600))) return tooManyRequests()

  const supabase = createServiceClient()
  const gate = await canAccessAlbum(supabase, id, userId)
  if (!gate) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!albumIsOpen(gate.startAt)) {
    return NextResponse.json({ error: 'Adding photos has closed' }, { status: 409 })
  }

  const { count } = await supabase
    .from('plan_photos')
    .select('id', { count: 'exact', head: true })
    .eq('plan_id', id)
    .eq('uploader_id', userId)
  if ((count ?? 0) >= PHOTO_CAP_PER_PERSON) {
    return NextResponse.json({ error: `You've added ${PHOTO_CAP_PER_PERSON}` }, { status: 409 })
  }

  const path = `${id}/${userId}/${randomUUID()}.jpg`
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    console.error('signed upload url failed:', error)
    return NextResponse.json({ error: 'Could not start the upload' }, { status: 500 })
  }

  return NextResponse.json({ path: data.path, token: data.token, signedUrl: data.signedUrl })
}
