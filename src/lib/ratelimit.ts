// Rate limiting, backed by the public.rate_limits table + rate_limit_hit RPC
// (migration 0004). Fixed-window counters keyed by route + caller identity.
//
// Fails OPEN: if the DB check errors, we allow the request rather than lock
// people out on an infra blip. Abuse protection, not a hard gate.

import { createServiceClient } from '@/lib/supabase/server'

/**
 * Records one hit against `key` and returns true if the caller is still under
 * `limit` within the rolling `windowSeconds`. Returns true (allow) on any error.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase.rpc('rate_limit_hit', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    })
    if (error) {
      console.error('rate limit check failed (allowing):', error.message)
      return true
    }
    return data ?? true
  } catch (e) {
    console.error('rate limit check threw (allowing):', e)
    return true
  }
}

/** Best-effort client IP from the proxy header Vercel sets. */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  return xff?.split(',')[0]?.trim() || 'unknown'
}

/** Standard 429 response body. */
export function tooManyRequests(message = 'Too many requests. Please try again shortly.') {
  return Response.json({ error: message }, { status: 429 })
}
