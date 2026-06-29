// POST /api/auth/logout
// Clears the mooves-token cookie. Client should also call firebaseAuth.signOut()
// before hitting this to clear the Firebase local session.

import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set('mooves-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
  return response
}
