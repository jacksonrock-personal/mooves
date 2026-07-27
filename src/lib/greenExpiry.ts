// 9.5 Part A — when a green auto-expires, derived from the coarse time chip.
// Computed CLIENT-SIDE at go-green so "3am" means the viewer's 3am (the server
// doesn't know their timezone); the server sanity-bounds what it stores.
//
//   now          → 4 hours after going green
//   tonight      → 3:00 AM that night (going green between midnight and 3am
//                  expires 3am the same night — the night is nearly over)
//   this week    → 3:00 AM Friday (18.1)
//   this weekend → 3:00 AM Monday
//   no chip      → 24 hours after going green
//
// 18.1: "this week" and "this weekend" tile the week with no overlap — week
// covers Mon–Thu nights, weekend covers Fri–Sun. The chip is only offered
// Mon–Thu (see isWeekChipAvailable), so a week green lives at most ~4.2 days.

const HOUR = 60 * 60 * 1000

const MONDAY = 1
const FRIDAY = 5

// Next 3:00 AM strictly after `from`, in local time.
function next3am(from: Date): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 3, 0, 0)
  if (d <= from) d.setDate(d.getDate() + 1)
  return d
}

// The next 3:00 AM that falls on `weekday`, strictly after `from`.
function next3amOnDay(from: Date, weekday: number): Date {
  const d = next3am(from)
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1)
  return d
}

// 18.1 — "This week" is only meaningful Mon–Thu. On Fri/Sat/Sun the span it would
// describe is already covered by "tonight" and "this weekend", and offering it
// would mint a green lasting up to 6 days. Local day, like every other chip.
export function isWeekChipAvailable(now: Date = new Date()): boolean {
  const day = now.getDay()
  return day >= MONDAY && day < FRIDAY
}

export function computeExpiresAt(statusTime: string | null, now: Date = new Date()): Date {
  if (statusTime === 'now') return new Date(now.getTime() + 4 * HOUR)
  if (statusTime === 'tonight') return next3am(now)
  // 3:00 AM Friday — the weekend belongs to the 'weekend' chip.
  if (statusTime === 'week') return next3amOnDay(now, FRIDAY)
  // 3:00 AM on the Monday after the upcoming (or current) weekend.
  if (statusTime === 'weekend') return next3amOnDay(now, MONDAY)
  return new Date(now.getTime() + 24 * HOUR)
}

// Has this green already expired? NULL = legacy green, never expires.
export function isGreenExpired(statusExpiresAt: string | null, now: Date = new Date()): boolean {
  if (!statusExpiresAt) return false
  const t = new Date(statusExpiresAt).getTime()
  return !Number.isNaN(t) && t <= now.getTime()
}
