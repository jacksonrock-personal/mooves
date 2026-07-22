// 13.2a — Discover day-group bucketing. Pure helpers, viewer-local clock.
// Server sends moves sorted start_at asc (NULLs last, newest-created tie-break);
// grouping preserves that order, so within every group cards stay chronological.
//
// Groups, fixed order: Today · Tomorrow · This weekend · Later · Weekly & recurring.
// Weekend = the Fri–Sun of the current-or-upcoming weekend, minus days already
// covered by Today/Tomorrow (so on Sat/Sun the bucket is empty and hidden).
// Viewed on Mon/Tue, a Wed/Thu move lands in Later (tops it — Later is chronological).
// ≤2 total moves → one label-less group (flat list, no headers).

import type { SponsoredMove } from '@/components/discover/SponsoredCard'

export interface MoveGroup {
  label: string | null
  moves: SponsoredMove[]
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

export function groupMoves(moves: SponsoredMove[], now: Date = new Date()): MoveGroup[] {
  if (moves.length <= 2) return moves.length > 0 ? [{ label: null, moves }] : []

  // Day indexes of the relevant weekend's Fri/Sat/Sun. Fri→{0,1,2}, Sat→{-1,0,1},
  // Sun→{-2,-1,0}, weekdays→upcoming Friday onward. Today/Tomorrow always win below.
  const dow = now.getDay() // 0 = Sunday
  const fridayOffset = dow === 6 ? -1 : dow === 0 ? -2 : 5 - dow
  const weekendDays = new Set([fridayOffset, fridayOffset + 1, fridayOffset + 2])

  const buckets: Record<string, SponsoredMove[]> = {
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
