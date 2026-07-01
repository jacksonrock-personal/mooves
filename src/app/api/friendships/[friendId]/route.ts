// DELETE /api/friendships/[friendId] — removes mutual friendship (both rows)

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ friendId: string }> }
) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { friendId } = await params
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('friendships')
    .delete()
    .or(
      `and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`
    )

  if (error) {
    console.error('Friendship delete error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }

  return new Response(null, { status: 204 })
}
