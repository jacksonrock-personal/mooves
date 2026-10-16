// R36
// DELETE /api/plans/[id]/photos/[photoId] — delete your own photo, or (as the
// Moove's creator) remove anyone's.
//
// Moderation, amended from the draft: the creator-remove is the whole safety
// story for albums, accepted knowingly because photos, unlike comments, are
// permanent. No reporting, no blocking.
//
// Access first (404 for anyone outside the album — including an uploader who
// has since left the Moove: leaving keeps your photos but costs you access),
// then permission (403 for a member trying someone else's photo).
// The row goes, its comments and likes cascade, and the storage object goes.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { PHOTO_BUCKET, canAccessAlbum, photoInAlbum } from '@/lib/photos'

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, photoId } = await params
  const supabase = createServiceClient()

  const gate = await canAccessAlbum(supabase, id, userId)
  if (!gate) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const photo = await photoInAlbum(supabase, id, photoId)
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (photo.uploaderId !== userId && !gate.isCreator) {
    return NextResponse.json({ error: 'Not yours' }, { status: 403 })
  }

  const { error } = await supabase.from('plan_photos').delete().eq('id', photo.id)
  if (error) {
    console.error('photo delete failed:', error)
    return NextResponse.json({ error: 'Could not remove that' }, { status: 500 })
  }

  // After the row, never before: a row pointing at a missing object would
  // render as a broken tile, an object without a row is simply invisible.
  try {
    await supabase.storage.from(PHOTO_BUCKET).remove([photo.storagePath])
  } catch (e) {
    console.error('photo object remove failed (row already gone):', e)
  }

  return NextResponse.json({ ok: true, removedByCreator: photo.uploaderId !== userId })
}
