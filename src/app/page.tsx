// Root (makemooves.app). Phase 14.2: serves the marketing landing page to
// logged-out visitors; authenticated users are redirected straight to /feed.
// `/` is a public route (exact-match) in middleware, so we resolve the session
// here from the mooves-token cookie (the same pattern as /g/[code]).
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken } from '@/lib/auth/session'
import LandingScreen from '@/components/landing/LandingScreen'

// Kept in step with the Phase 25 hero. The title is what a shared link renders
// as, so it has to be the headline, not the old one.
export const metadata: Metadata = {
  title: 'Mooves · Make it easier to hang out',
  description:
    'Go green when you’re free. Your friends see it, and now they know they can just ask you. Then make the plan over text.',
}

export default async function RootPage() {
  const token = (await cookies()).get('mooves-token')?.value
  if (token && (await verifySessionToken(token))) {
    redirect('/feed')
  }
  return <LandingScreen />
}
