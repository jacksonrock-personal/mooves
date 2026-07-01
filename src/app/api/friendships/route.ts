// POST /api/friendships
// Auth required. Creates a mutual friendship between the current user and the
// user identified by referral_code. Inserts both rows (A→B and B→A).
// Returns 201 on success, 409 if already friends, 404 if code not found.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { referral_code } = await req.json() as { referral_code?: string }
  if (!referral_code) {
    return NextResponse.json({ error: 'referral_code is required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Resolve referral_code → inviter
  const { data: inviter } = await supabase
    .from('users')
    .select('id, display_name')
    .eq('referral_code', referral_code)
    .single()

  if (!inviter) {
    return NextResponse.json({ error: 'Referral code not found' }, { status: 404 })
  }

  if (inviter.id === userId) {
    return NextResponse.json({ error: 'Cannot friend yourself' }, { status: 400 })
  }

  // Check for existing friendship
  const { data: existing } = await supabase
    .from('friendships')
    .select('user_id')
    .eq('user_id', userId)
    .eq('friend_id', inviter.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'Already friends', display_name: inviter.display_name },
      { status: 409 }
    )
  }

  // Insert both rows — mutual friendship model
  const { error } = await supabase.from('friendships').insert([
    { user_id: userId,     friend_id: inviter.id },
    { user_id: inviter.id, friend_id: userId     },
  ])

  if (error) {
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
