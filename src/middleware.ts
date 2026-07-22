import { NextResponse, type NextRequest } from 'next/server'
import { verifySessionToken } from '@/lib/auth/session'

const PUBLIC_PREFIXES = [
  '/join/',
  '/g/',
  '/auth',
  '/privacy',       // public legal pages (also required for SMS/A2P registration)
  '/terms',
  '/sponsor',       // sponsor portal has its own auth realm (mooves-sponsor-token)
  '/api/sponsor/',  // each /api/sponsor route self-gates via requireSponsor
  '/api/invite/',
  '/api/auth/verify',
  '/api/sms/inbound',
  '/api/stripe/webhook', // Stripe calls this unauthenticated; gated by signature

    // PWA assets (Phase 15) — must be served directly, never redirected. ...
  '/sw.js',
  '/manifest.webmanifest',
  '/brand/',
  '/icon',
  '/apple-icon',
  '/.well-known/',  // Apple Pay domain verification (Stripe) + future well-known files

  '/_next/',
  '/favicon',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // `/` (exact) is the public marketing landing page; the root server component
  // redirects authed visitors to /feed. Exact-match so it doesn't open every route.
  if (pathname === '/' || PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = req.cookies.get('mooves-token')?.value

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/auth', req.url))
  }

  const payload = await verifySessionToken(token)

  if (!payload) {
    const res = pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      : NextResponse.redirect(new URL('/auth', req.url))
    res.cookies.delete('mooves-token')
    return res
  }

  const headers = new Headers(req.headers)
  headers.set('x-user-id', payload.sub)
  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
