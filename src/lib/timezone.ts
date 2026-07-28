// Phase 22 — silent timezone capture.
//
// The app has deliberately never stored a timezone (18.1 punted it in as many
// words). It stores one now for exactly one reason: a job that fires at 9am
// local cannot run on a sleeping client.
//
// Captured rather than asked. The browser already knows, a picker would put
// friction into a flow that should be two taps, and an IANA name is not a
// secret. What is owed instead is DISCLOSURE — Settings shows the stored zone,
// read-only, so the one location-shaped fact this app keeps is visible to the
// person it describes.

/** The runtime's own IANA zone name, or null if it will not say. */
export function browserTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}

/**
 * Write the browser's zone if it differs from what is stored. Fire and forget:
 * this runs on app open and must never delay or break the screen that called
 * it. A user whose zone never lands is simply skipped by the scheduler.
 */
export async function syncTimezone(stored: string | null | undefined): Promise<void> {
  const tz = browserTimezone()
  if (!tz || tz === stored) return
  try {
    await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: tz }),
    })
  } catch {
    // best-effort; the next app open tries again
  }
}
