// POST /api/friendships
// Auth required. Creates a mutual friendship between the current user and the
// user identified by referral_code. Inserts both rows (A→B and B→A).
// Returns 201 on success, 409 if already friends, 404 if code not found.

import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  // 1. Verify the caller is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse body
  const { referral_code } = await req.json() as { referral_code?: string }
  if (!referral_code) {
    return NextResponse.json({ error: 'referral_code is required' }, { status: 400 })
  }

  // 3. Resolve referral_code → inviter user ID (use service client to bypass RLS)
  const admin = createServiceClient()
  const { data: inviter } = await admin
    .from('users')
    .select('id, display_name')
    .eq('referral_code', referral_code)
    .single()

  if (!inviter) {
    return NextResponse.json({ error: 'Referral code not found' }, { status: 404 })
  }

  // 4. Prevent self-friending
  if (inviter.id === user.id) {
    return NextResponse.json({ error: 'Cannot friend yourself' }, { status: 400 })
  }

  // 5. Check if friendship already exists
  const { data: existing } = await admin
    .from('friendships')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('friend_id', inviter.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'Already friends', display_name: inviter.display_name },
      { status: 409 }
    )
  }

  // 6. Insert both rows — mutual friendship model
  const { error } = await admin.from('friendships').insert([
    { user_id: user.id,    friend_id: inviter.id },
    { user_id: inviter.id, friend_id: user.id    },
  ])

  if (error) {
    // Postgres unique constraint violation → already friends (race condition)
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Already friends', display_name: inviter.display_name },
        { status: 409 }
      )
    }
    console.error('Friendship insert error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }

  return NextResponse.json({ display_name: inviter.display_name }, { status: 201 })
}
