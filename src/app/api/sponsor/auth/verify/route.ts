// POST /api/sponsor/auth/verify — Firebase phone OTP → sponsor session.
// Verifies the Firebase ID token, looks up or creates the sponsor by phone,
// and sets the mooves-sponsor-token cookie. Public (issues the session).

import { NextResponse } from 'next/server'
import { firebaseAdmin } from '@/lib/firebase/admin'
import { createServiceClient } from '@/lib/supabase/server'
import { signSponsorToken, SPONSOR_COOKIE, SPONSOR_SESSION_SECONDS } from '@/lib/auth/sponsor-session'

export async function POST(req: Request) {
  const { idToken, businessName } = (await req.json()) as { idToken?: string; businessName?: string }
  if (!idToken) return NextResponse.json({ error: 'idToken required' }, { status: 400 })

  let phoneNumber: string
  try {
    const decoded = await firebaseAdmin.verifyIdToken(idToken)
    if (!decoded.phone_number) return NextResponse.json({ error: 'No phone number in token' }, { status: 400 })
    phoneNumber = decoded.phone_number
  } catch {
    return NextResponse.json({ error: 'Invalid Firebase token' }, { status: 401 })
  }

  const supabase = createServiceClient()

  let sponsorId: string
  let isNew: boolean
  const { data: existing } = await supabase
    .from('sponsors')
    .select('id, business_name')
    .eq('phone', phoneNumber)
    .maybeSingle()

  if (existing) {
    sponsorId = existing.id
    isNew = false
    // Fill in the business name if this is the sign-up completing and it's still blank.
    if (!existing.business_name && businessName?.trim()) {
      await supabase.from('sponsors').update({ business_name: businessName.trim().slice(0, 80) }).eq('id', sponsorId)
    }
  } else {
    const { data: created, error } = await supabase
      .from('sponsors')
      .insert({ phone: phoneNumber, business_name: businessName?.trim().slice(0, 80) || null })
      .select('id')
      .single()
    if (error || !created) return NextResponse.json({ error: 'Failed to create sponsor' }, { status: 500 })
    sponsorId = created.id
    isNew = true
  }

  const token = await signSponsorToken(sponsorId, phoneNumber)
  const response = NextResponse.json({ isNew, sponsorId })
  response.cookies.set(SPONSOR_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SPONSOR_SESSION_SECONDS,
    path: '/',
  })
  return response
}
