// Root (makemooves.app). Phase 14.2: serves the marketing landing page to
// logged-out visitors; authenticated users are redirected straight to /feed.
// `/` is a public route (exact-match) in middleware, so we resolve the session
// here from the mooves-token cookie (the same pattern as /g/[code]).
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken } from '@/lib/auth/session'
import LandingScreen from '@/components/landing/LandingScreen'

export const metadata: Metadata = {
  title: 'Mooves — the easiest way to actually hang out',
  description: 'Go green when you’re free. The friends you picked see it. You make the plan over text.',
}

export default async function RootPage() {
  const token = (await cookies()).get('mooves-token')?.value
  if (token && (await verifySessionToken(token))) {
    redirect('/feed')
  }
  return <LandingScreen />
}
