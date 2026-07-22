// 9.5 Part A — when a green auto-expires, derived from the coarse time chip.
// Computed CLIENT-SIDE at go-green so "3am" means the viewer's 3am (the server
// doesn't know their timezone); the server sanity-bounds what it stores.
//
//   now          → 4 hours after going green
//   tonight      → 3:00 AM that night (going green between midnight and 3am
//                  expires 3am the same night — the night is nearly over)
//   this weekend → 3:00 AM Monday
//   no chip      → 24 hours after going green

const HOUR = 60 * 60 * 1000

// Next 3:00 AM strictly after `from`, in local time.
function next3am(from: Date): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 3, 0, 0)
  if (d <= from) d.setDate(d.getDate() + 1)
  return d
}

export function computeExpiresAt(statusTime: string | null, now: Date = new Date()): Date {
  if (statusTime === 'now') return new Date(now.getTime() + 4 * HOUR)
  if (statusTime === 'tonight') return next3am(now)
  if (statusTime === 'weekend') {
    // 3:00 AM on the Monday after the upcoming (or current) weekend.
    const d = next3am(now)
    while (d.getDay() !== 1) d.setDate(d.getDate() + 1)
    return d
  }
  return new Date(now.getTime() + 24 * HOUR)
}

// Has this green already expired? NULL = legacy green, never expires.
export function isGreenExpired(statusExpiresAt: string | null, now: Date = new Date()): boolean {
  if (!statusExpiresAt) return false
  const t = new Date(statusExpiresAt).getTime()
  return !Number.isNaN(t) && t <= now.getTime()
}
