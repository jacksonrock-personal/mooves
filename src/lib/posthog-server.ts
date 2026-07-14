// Server-side PostHog capture (Node SDK).
// Used by API routes that need to fire analytics without a browser context —
// e.g. the Twilio SMS webhook (Screen 11).

import { PostHog } from 'posthog-node'

let client: PostHog | null = null

function getClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return null
  if (!client) {
    client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    })
  }
  return client
}

// Capture a single event and flush immediately. Safe to await in a request
// handler; swallows its own errors so analytics can never break the response.
export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const ph = getClient()
  if (!ph) return
  try {
    ph.capture({ distinctId, event, properties })
    await ph.flush()
  } catch {
    // analytics is best-effort — never surface to the caller
  }
}
