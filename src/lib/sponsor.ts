// Sponsor route gate (Phase 13 surface 3). Reads + verifies the sponsor cookie.
// Middleware skips the consumer-token check for /api/sponsor/*, so each sponsor
// route enforces its own auth via this helper.

import { cookies } from 'next/headers'
import { verifySponsorToken, SPONSOR_COOKIE } from '@/lib/auth/sponsor-session'

/** Returns the authenticated sponsor id, or null if not signed in as a sponsor. */
export async function requireSponsor(): Promise<string | null> {
  const token = (await cookies()).get(SPONSOR_COOKIE)?.value
  if (!token) return null
  const payload = await verifySponsorToken(token)
  return payload?.sub ?? null
}
