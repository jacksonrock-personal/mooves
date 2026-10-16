// R36
// GET  /api/plans/[id]/photos — the album: header, roster, photos (signed URLs)
// POST /api/plans/[id]/photos — confirm one uploaded photo { path, width, height }
//
// The access rule is canAccessAlbum: author or a move_joins row for THIS plan,
// plan over, not cancelled. Anyone else gets 404 — never 403, because a 403
// admits there is an album here (wall 3).
//
// Uploading is two steps so the file never passes through this server:
//   1. POST upload-url  → a signed upload URL for `${planId}/${me}/${uuid}.jpg`
//   2. the browser PUTs the re-encoded JPEG straight to storage
//   3. POST here        → the row, after re-checking window, cap and that the
//                         object really exists at a path this caller was issued
//
// The "photos added" push is NOT sent from here, one per photo. The client
// calls /photos/added once when a selection finishes, so six photos make one
// push that says six.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit, tooManyRequests } from '@/lib/ratelimit'
import {
  PHOTO_BUCKET,
  PHOTO_CAP_PER_PERSON,
  PHOTO_URL_TTL_SECONDS,
  albumClosesAt,
  albumIsOpen,
  albumRoster,
  canAccessAlbum,
  isOwnPhotoPath,
  type Album,
  type AlbumPhoto,
} from '@/lib/photos'

const notFound = () => NextResponse.json({ error: 'Not found' }, { status: 404 })

function dimension(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  const n = Math.round(v)
  return n >= 1 && n <= 10000 ? n : null
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()
  const gate = await canAccessAlbum(supabase, id, userId)
  if (!gate) return notFound()

  const [people, photosRes] = await Promise.all([
    albumRoster(supabase, id, gate.authorId),
    supabase
      .from('plan_photos')
      .select('id, uploader_id, storage_path, width, height, created_at')
      .eq('plan_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (photosRes.error) {
    console.error('album load failed:', photosRes.error)
    return NextResponse.json({ error: 'Could not load' }, { status: 500 })
  }
  const rows = photosRes.data ?? []

  // Uploaders may have left the Moove (their photos stay), so their names are
  // looked up directly rather than from the roster.
  const uploaderIds = [...new Set(rows.map(r => r.uploader_id))]
  const { data: uploaders } = uploaderIds.length
    ? await supabase.from('users').select('id, display_name, avatar_url').in('id', uploaderIds)
    : { data: [] as { id: string; display_name: string | null; avatar_url: string | null }[] }
  const uploaderById = new Map((uploaders ?? []).map(u => [u.id, u]))

  const signed = new Map<string, string>()
  if (rows.length) {
    const { data: urls } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(rows.map(r => r.storage_path), PHOTO_URL_TTL_SECONDS)
    for (const u of urls ?? []) {
      if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl)
    }
  }

  const photos: AlbumPhoto[] = rows
    .filter(r => signed.has(r.storage_path))
    .map(r => ({
      id: r.id,
      uploaderId: r.uploader_id,
      uploaderName: uploaderById.get(r.uploader_id)?.display_name ?? null,
      uploaderAvatar: uploaderById.get(r.uploader_id)?.avatar_url ?? null,
      createdAt: r.created_at,
      width: r.width,
      height: r.height,
      url: signed.get(r.storage_path) as string,
    }))

  const myCount = rows.filter(r => r.uploader_id === userId).length
  const album: Album = {
    plan: {
      id: gate.planId,
      title: gate.title,
      startAt: gate.startAt,
      hasTime: gate.hasTime,
      timeMode: gate.timeMode,
      locationText: gate.locationText,
      authorId: gate.authorId,
    },
    people,
    photos,
    myCount,
    canAdd: albumIsOpen(gate.startAt) && myCount < PHOTO_CAP_PER_PERSON,
    isCreator: gate.isCreator,
    closesAt: albumClosesAt(gate.startAt).toISOString(),
  }
  return NextResponse.json(album)
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!(await checkRateLimit(`photos:confirm:${userId}`, 300, 3600))) return tooManyRequests()

  const supabase = createServiceClient()
  const gate = await canAccessAlbum(supabase, id, userId)
  if (!gate) return notFound()

  let payload: { path?: unknown; width?: unknown; height?: unknown }
  try {
    payload = (await req.json()) as typeof payload
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  // Path tampering: only `${planId}/${me}/${uuid}.jpg` — the exact shape
  // upload-url issues to THIS caller for THIS plan — is accepted.
  if (!isOwnPhotoPath(payload.path, id, userId)) {
    return NextResponse.json({ error: 'Bad path' }, { status: 400 })
  }
  const path = payload.path

  const bucket = supabase.storage.from(PHOTO_BUCKET)
  const discard = async () => {
    try {
      await bucket.remove([path])
    } catch {
      // best effort — an orphan object is invisible without a row
    }
  }

  if (!albumIsOpen(gate.startAt)) {
    await discard()
    return NextResponse.json({ error: 'Adding photos has closed' }, { status: 409 })
  }

  const { count } = await supabase
    .from('plan_photos')
    .select('id', { count: 'exact', head: true })
    .eq('plan_id', id)
    .eq('uploader_id', userId)
  if ((count ?? 0) >= PHOTO_CAP_PER_PERSON) {
    await discard()
    return NextResponse.json({ error: `You've added ${PHOTO_CAP_PER_PERSON}` }, { status: 409 })
  }

  const { data: exists } = await bucket.exists(path)
  if (!exists) return NextResponse.json({ error: 'Upload not found' }, { status: 400 })

  const { data, error } = await supabase
    .from('plan_photos')
    .insert({
      plan_id: id,
      uploader_id: userId,
      storage_path: path,
      width: dimension(payload.width),
      height: dimension(payload.height),
    })
    .select('id, created_at')
    .single()

  if (error || !data) {
    // 23505 = this path was already confirmed. Idempotent for a retrying client.
    if (error?.code === '23505') return NextResponse.json({ error: 'Already added' }, { status: 409 })
    // 23514 = the cap trigger caught a race the count above could not.
    if (error?.code === '23514') {
      await discard()
      return NextResponse.json({ error: `You've added ${PHOTO_CAP_PER_PERSON}` }, { status: 409 })
    }
    console.error('photo insert failed:', error)
    return NextResponse.json({ error: 'Could not add that' }, { status: 500 })
  }

  const { data: url } = await bucket.createSignedUrl(path, PHOTO_URL_TTL_SECONDS)
  return NextResponse.json(
    { id: data.id, createdAt: data.created_at, url: url?.signedUrl ?? null },
    { status: 201 },
  )
}
