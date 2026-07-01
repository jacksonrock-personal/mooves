// GET /api/friends — all mutual friends (for People screen)

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: friendships, error } = await supabase
    .from('friendships')
    .select('friend_id, users!friend_id(id, display_name, avatar_url)')
    .eq('user_id', userId)
    .order('display_name', { referencedTable: 'users', ascending: true })

  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 })

  const friends = (friendships ?? []).map(f => {
    const u = f.users as { id: string; display_name: string | null; avatar_url: string | null } | null
    return {
      id: u?.id ?? f.friend_id,
      displayName: u?.display_name ?? null,
      avatarUrl: u?.avatar_url ?? null,
    }
  })

  return NextResponse.json({ friends })
}
