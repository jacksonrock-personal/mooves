// Phase 20 — Planned Mooves.
//
// A Moove has a day, a green does not. That is the whole line between the two
// objects: the date is required, the clock time is optional, and everything else
// (place, note) is decoration. "Sunday, long walk, lake path" is a real Moove.
//
// Like green expiry (9.5 Part A), the timestamps are computed CLIENT-SIDE from
// the author's local calendar, because the server does not know their timezone.
// The server only sanity-bounds what it is handed. Storing timezones is Phase 22.

export interface PlanJoiner {
  id: string
  displayName: string | null
  avatarUrl: string | null
  /** Only populated for the author, who owns the group-text action. */
  phone: string | null
}

export interface Plan {
  id: string
  authorId: string
  authorName: string | null
  authorAvatar: string | null
  title: string
  startAt: string
  hasTime: boolean
  locationText: string | null
  note: string | null
  isMine: boolean
  /** 13.8 — set when this Moove was brought over from a sponsored move. */
  sponsorBrand: string | null
  visibleGroups: string[]
  joiners: PlanJoiner[]
  joinedByMe: boolean
}

export const PLAN_TITLE_MAX = 80
export const PLAN_LOCATION_MAX = 80
export const PLAN_NOTE_MAX = 200

/** Mirrors the Discover grace period so a Moove lingers briefly once it starts. */
const GRACE_HOURS = 3

/**
 * When a Moove drops out of the feed.
 *   time set  → 3 hours after it starts (you can still join people mid-thing)
 *   date only → end of that local day, since there is no start to count from
 */
export function computePlanExpiry(startAt: Date, hasTime: boolean): Date {
  if (hasTime) return new Date(startAt.getTime() + GRACE_HOURS * 60 * 60 * 1000)
  return new Date(startAt.getFullYear(), startAt.getMonth(), startAt.getDate(), 23, 59, 59, 999)
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** "Tonight" · "Tomorrow" · "Saturday" · "Aug 14" — viewer-local, always. */
export function relativeDay(startAt: Date, now: Date = new Date()): string {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  if (sameDay(startAt, now)) return 'Tonight'
  if (sameDay(startAt, tomorrow)) return 'Tomorrow'

  const days = Math.round(
    (new Date(startAt.getFullYear(), startAt.getMonth(), startAt.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86400000,
  )
  // Inside the coming week a weekday name is the most readable thing there is.
  if (days > 0 && days < 7) return startAt.toLocaleDateString('en-US', { weekday: 'long' })
  return startAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * The card's lead tile. Two short lines, and which two depends entirely on
 * whether a time was set — that is what makes a date-only Moove read as
 * deliberate rather than as a Moove missing its time.
 *   time set  → "8:30" / "PM"
 *   date only → "SAT"  / "AUG 2"
 */
export function planTile(startAt: Date, hasTime: boolean): { top: string; bottom: string } {
  if (hasTime) {
    const [time, meridiem] = startAt
      .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      .split(' ')
    return { top: time ?? '', bottom: meridiem ?? '' }
  }
  return {
    top: startAt.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    bottom: startAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(),
  }
}

/** "Tonight, Logan Square" · "Sunday, no set time" — the tile carries the rest. */
export function planWhenLine(
  startAt: Date,
  hasTime: boolean,
  locationText: string | null,
  now: Date = new Date(),
): string {
  const day = relativeDay(startAt, now)
  const place = locationText?.trim()
  if (place) return `${day}, ${place}`
  return hasTime ? day : `${day}, no set time`
}

/** Has this Moove dropped out of the feed already? */
export function isPlanOver(startAt: string, hasTime: boolean, now: Date = new Date()): boolean {
  const d = new Date(startAt)
  if (Number.isNaN(d.getTime())) return true
  return computePlanExpiry(d, hasTime).getTime() <= now.getTime()
}
