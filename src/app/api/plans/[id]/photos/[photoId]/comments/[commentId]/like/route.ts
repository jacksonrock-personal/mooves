// R36 — like / unlike a photo comment. Mirrors the R8 Moove comment like route.
//
// POST   = like
// DELETE = unlike
//
// Same gate as reading the comment (album access + the photo belongs to this
// plan + the comment belongs to this photo). The count lives beside its heart
// and nowhere else. No push, ever.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit, tooManyRequests } from '@/lib/ratelimit'
import { canAccessAlbum, photoInAlbum } from '@/lib/photos'

type Supabase = ReturnType<typeof createServiceClient>

async function gate(
  supabase: Supabase,
  planId: string,
  photoId: string,
  commentId: string,
  userId: string,
): Promise<boolean> {
  if (!(await canAccessAlbum(supabase, planId, userId))) return false
  if (!(await photoInAlbum(supabase, planId, photoId))) return false

  const { data: comment } = await supabase
    .from('plan_photo_comments')
    .select('id')
    .eq('id', commentId)
    .eq('photo_id', photoId)
    .maybeSingle()
  return !!comment
}

async function countFor(supabase: Supabase, commentId: string): Promise<number> {
  const { count } = await supabase
    .from('plan_photo_comment_likes')
    .select('comment_id', { count: 'exact', head: true })
    .eq('comment_id', commentId)
  return count ?? 0
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; photoId: string; commentId: string }> },
) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, photoId, commentId } = await params
  if (!(await checkRateLimit(`photo-comments:like:${userId}`, 240, 3600))) return tooManyRequests()

  const supabase = createServiceClient()
  if (!(await gate(supabase, id, photoId, commentId, userId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('plan_photo_comment_likes')
    .upsert({ comment_id: commentId, user_id: userId }, { onConflict: 'comment_id,user_id' })

  if (error) {
    console.error('photo comment like failed:', error)
    return NextResponse.json({ error: 'Could not do that' }, { status: 500 })
  }

  return NextResponse.json({ likeCount: await countFor(supabase, commentId), likedByMe: true })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; photoId: string; commentId: string }> },
) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, photoId, commentId } = await params
  const supabase = createServiceClient()
  if (!(await gate(supabase, id, photoId, commentId, userId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('plan_photo_comment_likes')
    .delete()
    .eq('comment_id', commentId)
    .eq('user_id', userId)

  if (error) {
    console.error('photo comment unlike failed:', error)
    return NextResponse.json({ error: 'Could not do that' }, { status: 500 })
  }

  return NextResponse.json({ likeCount: await countFor(supabase, commentId), likedByMe: false })
}
