// POST /api/sponsor/auth/logout — clear the sponsor session.

import { NextResponse } from 'next/server'
import { SPONSOR_COOKIE } from '@/lib/auth/sponsor-session'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(SPONSOR_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
  return response
}
