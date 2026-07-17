import { NextResponse, type NextRequest } from 'next/server'
import { verifySessionToken } from '@/lib/auth/session'

const PUBLIC_PREFIXES = [
  '/join/',
  '/g/',
  '/auth',
  '/api/invite/',
  '/api/auth/verify',
  '/api/sms/inbound',
  '/_next/',
  '/favicon',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
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
