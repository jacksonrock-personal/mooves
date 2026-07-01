// GET /api/auth/supabase-token
// Returns a short-lived Supabase-compatible JWT for client-side Realtime.
// The mooves-token cookie is httpOnly — JS can't read it directly.
// This endpoint reads it server-side and issues a 1-hour Realtime token.

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/auth/session'
import { signSupabaseJwt } from '@/lib/auth/supabase-jwt'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('mooves-token')?.value

  if (!token) {
    return NextResponse.json({ token: null }, { status: 401 })
  }

  const payload = await verifySessionToken(token)
  if (!payload) {
    return NextResponse.json({ token: null }, { status: 401 })
  }

  const supabaseToken = await signSupabaseJwt(payload.sub)
  return NextResponse.json({ token: supabaseToken, userId: payload.sub })
}
