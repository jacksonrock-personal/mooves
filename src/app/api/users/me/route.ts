// GET /api/users/me   — current user's full profile
// PATCH /api/users/me — partial profile update (displayName, avatarUrl, onboardingComplete)
// DELETE /api/users/me — hard-delete account (cascades via FK)

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { lookupZip } from '@/lib/geo'
import { INTEREST_SLUGS } from '@/lib/interests'

export async function GET(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, phone, display_name, avatar_url, referral_code, is_available, is_admin, status_note, status_time, status_move_id, visible_to, onboarding_complete, area_zip, interests')
    .eq('id', userId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Derive the display label from the stored zip; nothing else is persisted.
  const area = data.area_zip ? lookupZip(data.area_zip) : null

  // Resolve the viewer's own anchored sponsored move (13.8), for their move card.
  let anchoredMove = null
  if (data.status_move_id) {
    const { data: m } = await supabase
      .from('sponsored_moves')
      .select('id, title, description, brand, category, time_text, link_url')
      .eq('id', data.status_move_id)
      .maybeSingle()
    if (m) {
      anchoredMove = {
        id: m.id,
        title: m.title,
        description: m.description,
        brand: m.brand,
        category: m.category,
        timeText: m.time_text,
        linkUrl: m.link_url,
      }
    }
  }

  return NextResponse.json({
    id: data.id,
    phone: data.phone,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
    referralCode: data.referral_code,
    isAvailable: data.is_available,
    isAdmin: data.is_admin,
    statusNote: data.status_note,
    statusTime: data.status_time,
    statusMoveId: data.status_move_id,
    anchoredMove,
    visibleTo: data.visible_to,
    onboardingComplete: data.onboarding_complete,
    areaZip: data.area_zip,
    areaCity: area?.city ?? null,
    areaState: area?.state ?? null,
    interests: (data.interests ?? []).filter(s => INTEREST_SLUGS.includes(s)),
  })
}

export async function PATCH(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    displayName?: string
    avatarUrl?: string | null
    onboardingComplete?: boolean
    interests?: string[]
  }

  type UserUpdate = {
    display_name?: string
    avatar_url?: string | null
    onboarding_complete?: boolean
    interests?: string[]
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
  if (body.interests !== undefined) {
    // Keep only known curated slugs; de-dupe.
    updates.interests = [...new Set(body.interests.filter(s => INTEREST_SLUGS.includes(s)))]
  }

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

  // Best-effort: remove any avatar files under the user's Storage folder.
  // Never block account deletion on a Storage hiccup.
  try {
    const { data: files } = await supabase.storage.from('Avatars').list(userId)
    if (files && files.length > 0) {
      await supabase.storage
        .from('Avatars')
        .remove(files.map(f => `${userId}/${f.name}`))
    }
  } catch {
    // ignore — the user row deletion below is what matters
  }

  // Hard-delete the user; FK cascades remove friendships, groups, group_members.
  const { error } = await supabase.from('users').delete().eq('id', userId)

  if (error) {
    console.error('Account deletion error:', error)
    return NextResponse.json({ error: 'Deletion failed' }, { status: 500 })
  }

  // Clear the session cookie so the client lands unauthenticated.
  const response = new Response(null, { status: 204 })
  response.headers.set(
    'Set-Cookie',
    `mooves-token=; HttpOnly; ${
      process.env.NODE_ENV === 'production' ? 'Secure; ' : ''
    }SameSite=Lax; Path=/; Max-Age=0`,
  )
  return response
}
