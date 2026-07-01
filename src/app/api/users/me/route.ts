// GET /api/users/me   — current user's full profile
// PATCH /api/users/me — partial profile update (displayName, avatarUrl, onboardingComplete)
// DELETE /api/users/me — hard-delete account (cascades via FK)

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, phone, display_name, avatar_url, referral_code, is_available, status_note, visible_to, onboarding_complete')
    .eq('id', userId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    id: data.id,
    phone: data.phone,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
    referralCode: data.referral_code,
    isAvailable: data.is_available,
    statusNote: data.status_note,
    visibleTo: data.visible_to,
    onboardingComplete: data.onboarding_complete,
  })
}

export async function PATCH(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    displayName?: string
    avatarUrl?: string | null
    onboardingComplete?: boolean
  }

  type UserUpdate = {
    display_name?: string
    avatar_url?: string | null
    onboarding_complete?: boolean
  }
  const updates: UserUpdate = {}

  if (body.displayName !== undefined) {
    const name = body.displayName.trim()
    if (name.length === 0) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    if (name.length > 30) return NextResponse.json({ error: 'Name too long' }, { status: 400 })
    updates.display_name = name
  }
  if (body.avatarUrl !== undefined) updates.avatar_url = body.avatarUrl
  if (body.onboardingComplete !== undefined) updates.onboarding_complete = body.onboardingComplete

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select('id, phone, display_name, avatar_url, referral_code, is_available, status_note, visible_to, onboarding_complete')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  return NextResponse.json({
    id: data.id,
    phone: data.phone,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
    referralCode: data.referral_code,
    isAvailable: data.is_available,
    statusNote: data.status_note,
    visibleTo: data.visible_to,
    onboardingComplete: data.onboarding_complete,
  })
}

export async function DELETE(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { error } = await supabase.from('users').delete().eq('id', userId)

  if (error) {
    console.error('Account deletion error:', error)
    return NextResponse.json({ error: 'Deletion failed' }, { status: 500 })
  }

  return new Response(null, { status: 204 })
}
