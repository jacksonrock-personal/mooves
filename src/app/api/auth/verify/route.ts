// POST /api/auth/verify
//
// Firebase ↔ Supabase bridge. Called after the client completes Firebase phone OTP.
//   1. Verifies the Firebase ID token server-side
//   2. Looks up or creates the user in our Supabase users table
//   3. Mints a mooves-token (Supabase-compatible JWT) and sets it as httpOnly cookie

import { NextResponse } from 'next/server'
import { firebaseAdmin } from '@/lib/firebase/admin'
import { createServiceClient } from '@/lib/supabase/server'
import { signSessionToken } from '@/lib/auth/session'
import { generateReferralCode } from '@/lib/referral'

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30  // 30 days

export async function POST(req: Request) {
  const { idToken } = await req.json() as { idToken?: string }

  if (!idToken) {
    return NextResponse.json({ error: 'idToken required' }, { status: 400 })
  }

  // ── 1. Verify Firebase token ───────────────────────────────────────────────
  let phoneNumber: string
  try {
    const decoded = await firebaseAdmin.verifyIdToken(idToken)
    if (!decoded.phone_number) {
      return NextResponse.json({ error: 'No phone number in token' }, { status: 400 })
    }
    phoneNumber = decoded.phone_number
  } catch {
    return NextResponse.json({ error: 'Invalid Firebase token' }, { status: 401 })
  }

  // ── 2. Look up or create the Supabase user ────────────────────────────────
  const supabase = createServiceClient()

  let userId: string
  let isNewUser: boolean
  let onboardingComplete: boolean

  const { data: existing } = await supabase
    .from('users')
    .select('id, onboarding_complete')
    .eq('phone', phoneNumber)
    .maybeSingle() as { data: { id: string; onboarding_complete: boolean } | null }

  if (existing) {
    userId = existing.id
    isNewUser = false
    onboardingComplete = existing.onboarding_complete
  } else {
    // Generate referral_code here — column is NOT NULL with no DB default
    let referralCode = generateReferralCode()
    let created: { id: string } | null = null
    let error: unknown = null

    // Retry on the rare collision (collision probability negligible at MVP scale)
    for (let attempt = 0; attempt < 3; attempt++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await supabase
        .from('users')
        .insert({ phone: phoneNumber, referral_code: referralCode } as any)
        .select('id')
        .single() as { data: { id: string } | null; error: unknown }
      if (!result.error) { created = result.data; break }
      if ((result.error as { code?: string }).code === '23505') { referralCode = generateReferralCode(); continue }
      error = result.error; break
    }

    if (error || !created) {
      console.error('Failed to create user:', error)
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
    }

    userId = created.id
    isNewUser = true
    onboardingComplete = false
  }

  // ── 3. Mint mooves-token ──────────────────────────────────────────────────
  const token = await signSessionToken(userId, phoneNumber)

  const response = NextResponse.json({ isNewUser, onboardingComplete, userId })
  response.cookies.set('mooves-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION_SECONDS,
    path: '/',
  })

  return response
}
