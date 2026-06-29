// GET /api/auth/session
// Returns the mooves-token so client components can initialize Supabase Realtime.
// The cookie is httpOnly so JS can't read it directly — this endpoint bridges that.
// Only used for the Realtime subscription on the feed. All other data fetching
// happens in Server Components which read the cookie directly.

import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('mooves-token')?.value

  if (!token) {
    return NextResponse.json({ token: null }, { status: 401 })
  }

  try {
    const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!)
    const { payload } = await jwtVerify(token, secret)
    // Return the token and the user's ID (sub) for convenience
    return NextResponse.json({ token, userId: payload.sub })
  } catch {
    return NextResponse.json({ token: null }, { status: 401 })
  }
}
