// Middleware runs on every request (except static assets).
// Validates the mooves-token cookie using the Supabase JWT secret.
// Redirects unauthenticated users away from protected routes and vice versa.
//
// Uses `jose` (not `jsonwebtoken`) because middleware runs in the Edge Runtime
// which doesn't have Node.js crypto. jose is Edge-compatible.

import { jwtVerify } from 'jose'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED = ['/feed', '/people', '/settings', '/onboarding']
const AUTH_ONLY = ['/auth']  // redirect to /feed if already logged in

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('mooves-token')?.value
  const path  = request.nextUrl.pathname

  let isAuthenticated = false

  if (token) {
    try {
      const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!)
      await jwtVerify(token, secret)
      isAuthenticated = true
    } catch {
      // Token missing, expired, or tampered — treat as unauthenticated
    }
  }

  if (!isAuthenticated && PROTECTED.some(r => path.startsWith(r))) {
    return NextResponse.redirect(new URL('/auth', request.url))
  }

  if (isAuthenticated && AUTH_ONLY.some(r => path.startsWith(r))) {
    return NextResponse.redirect(new URL('/feed', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
