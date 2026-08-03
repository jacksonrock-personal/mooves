// 13.2a — Discover day-group bucketing. Pure helpers, viewer-local clock.
// Server sends moves sorted start_at asc (NULLs last, newest-created tie-break);
// grouping preserves that order, so within every group cards stay chronological.
//
// Groups, fixed order: Today · Tomorrow · This weekend · Later · Weekly & recurring.
// Weekend = the Fri–Sun of the current-or-upcoming weekend, minus days already
// covered by Today/Tomorrow (so on Sat/Sun the bucket is empty and hidden).
// Viewed on Mon/Tue, a Wed/Thu move lands in Later (tops it — Later is chronological).
// ≤2 total moves → one label-less group (flat list, no headers).

// 24.8 — generic over anything carrying a startAt, so browse can group the new
// NearMove payload without this file knowing about either card component.
export interface Datedish {
  startAt: string | null
}

export interface MoveGroup<T extends Datedish = Datedish> {
  label: string | null
  moves: T[]
}

// Started already but still inside the 3h expiry grace (mirrors the server window).
export function isHappeningNow(startAt: string | null, now: Date = new Date()): boolean {
  if (!startAt) return false
  const start = new Date(startAt).getTime()
  if (Number.isNaN(start)) return false
  const t = now.getTime()
  return start <= t && t < start + 3 * 60 * 60 * 1000
}

// Whole calendar days from today to the move's local start day (0 = today).
function dayIndex(startAt: string, now: Date): number {
  const start = new Date(startAt)
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((startDay.getTime() - today.getTime()) / 86_400_000)
}

/**
 * Day offsets of the relevant weekend's Fri/Sat/Sun.
 * Fri→{0,1,2} · Sat→{-1,0,1} · Sun→{-2,-1,0} · weekdays→upcoming Friday onward.
 * Shared so browse's Weekend filter and the "This weekend" bucket can never
 * disagree about which days a weekend is.
 */
export function weekendOffsets(now: Date): { first: number; last: number } {
  const dow = now.getDay() // 0 = Sunday
  const first = dow === 6 ? -1 : dow === 0 ? -2 : 5 - dow
  return { first, last: first + 2 }
}

/** 24.8 — browse's time segment. Evergreen has no day, so every dated filter
 *  excludes it; "All week" is where recurring things live. */
export function matchesWhen(
  startAt: string | null,
  when: 'all' | 'tonight' | 'tomorrow' | 'weekend',
  now: Date = new Date(),
): boolean {
  if (when === 'all') return true
  if (!startAt) return false
  const d = dayIndex(startAt, now)
  if (when === 'tonight') return d <= 0
  if (when === 'tomorrow') return d === 1
  const { first, last } = weekendOffsets(now)
  return d >= first && d <= last
}

export function groupMoves<T extends Datedish>(moves: T[], now: Date = new Date()): MoveGroup<T>[] {
  if (moves.length <= 2) return moves.length > 0 ? [{ label: null, moves }] : []

  // Today/Tomorrow always win over the weekend bucket below.
  const { first } = weekendOffsets(now)
  const weekendDays = new Set([first, first + 1, first + 2])

  const buckets: Record<string, T[]> = {
    Today: [], Tomorrow: [], 'This weekend': [], Later: [], 'Weekly & recurring': [],
  }
  for (const m of moves) {
    if (!m.startAt) buckets['Weekly & recurring'].push(m)
    else {
      const d = dayIndex(m.startAt, now)
      if (d <= 0) buckets.Today.push(m) // d < 0 only within the expiry grace
      else if (d === 1) buckets.Tomorrow.push(m)
      else if (weekendDays.has(d)) buckets['This weekend'].push(m)
      else buckets.Later.push(m)
    }
  }
  return Object.entries(buckets)
    .filter(([, ms]) => ms.length > 0)
    .map(([label, ms]) => ({ label, moves: ms }))
}
