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

/**
 * How precisely a Moove is scheduled.
 *
 * The coarse modes deliberately reuse the green vocabulary, and they are why
 * "a Moove has a day, a green does not" is no longer the dividing line. The
 * line is now: a green is YOU BEING FREE, a Moove is A THING YOU ARE DOING.
 */
export type PlanTimeMode = 'tonight' | 'week' | 'weekend' | 'date' | 'datetime'

export const COARSE_MODES: PlanTimeMode[] = ['tonight', 'week', 'weekend']

export const TIME_MODE_LABEL: Record<PlanTimeMode, string> = {
  tonight: 'Tonight',
  week: 'This week',
  weekend: 'This weekend',
  date: '',
  datetime: '',
}

export function isCoarse(mode: PlanTimeMode): boolean {
  return mode === 'tonight' || mode === 'week' || mode === 'weekend'
}

export interface Plan {
  id: string
  authorId: string
  authorName: string | null
  authorAvatar: string | null
  title: string
  startAt: string
  hasTime: boolean
  timeMode: PlanTimeMode
  locationText: string | null
  note: string | null
  isMine: boolean
  /** 13.8 — set when this Moove was brought over from a sponsored move. */
  sponsorBrand: string | null
  visibleGroups: string[]
  /**
   * The raw group ids this Moove is scoped to — AUTHOR ONLY, null for everyone
   * else and null when it is unscoped.
   *
   * `visibleGroups` above is group NAMES, filtered to the ones the viewer shares
   * and only when show_groups is on: a display string, useless for reopening the
   * edit form. Without these ids the composer had nothing to prefill from, so it
   * opened every edit on "Everyone" and then wrote that back — silently widening
   * a group-scoped Moove to all of the author's friends.
   */
  visibleTo: string[] | null
  /**
   * R16 — the individual friends this Moove is scoped to, unioned with the
   * groups above. AUTHOR ONLY, and null for everyone else, exactly like
   * `visibleTo` and for the same reason: without it the edit composer cannot
   * know who the Moove reaches and would write its guess back over the truth.
   *
   * It is never rendered on a card. Naming individuals is a visibility rule,
   * not a label — 18.2's "shared with" line stays groups-only.
   */
  visibleUserIds: string[] | null
  /** Author only. Pairs with `visibleTo` so an edit round-trips both. */
  showGroups: boolean
  joiners: PlanJoiner[]
  joinedByMe: boolean
  /**
   * Phase 21, second revision — a TOTAL, never an unread count.
   *
   * R28: this is now the real count for anyone in the Moove's audience, which
   * after R28 is exactly the set who can open the thread. It used to be 0 for
   * non-joiners, back when they could not read it.
   */
  commentCount: number
  /**
   * R29 — the mutual friend who connects the viewer to the author, or null.
   *
   * NULL IS THE BRANCH. It is null on every first-degree Moove and non-null on
   * every one-hop-out Moove, so the card draws the vouch chip if and only if
   * there is a name to put in it, and no separate "is this a FoF Moove" flag can
   * fall out of step with the name it is supposed to accompany.
   */
  viaName: string | null
  /** Author only, like `visibleTo`, so an edit round-trips the toggle. */
  openToFof: boolean
}

export const PLAN_TITLE_MAX = 80
export const PLAN_LOCATION_MAX = 80
export const PLAN_NOTE_MAX = 200

/** Mirrors the Discover grace period so a Moove lingers briefly once it starts. */
const GRACE_HOURS = 3

const MONDAY = 1
const FRIDAY = 5
const SUNDAY = 0

/** End of `d`'s local day. */
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

/** End of the next local day that falls on `weekday`, today included. */
function endOfNextDay(from: Date, weekday: number): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1)
  return endOfDay(d)
}

/**
 * The sort key for a coarse Moove: the END of its window.
 *
 * Deliberate — it puts "Saturday 9am" above "sometime this weekend", so a
 * concrete plan always outranks a vague one covering the same span.
 *   tonight → end of today
 *   week    → end of Thursday (Phase 18: week covers Mon–Thu, weekend takes Fri–Sun)
 *   weekend → end of Sunday
 */
export function coarseSortAt(mode: PlanTimeMode, now: Date = new Date()): Date {
  if (mode === 'tonight') return endOfDay(now)
  if (mode === 'week') return endOfNextDay(now, FRIDAY - 1)
  if (mode === 'weekend') return endOfNextDay(now, SUNDAY)
  return endOfDay(now)
}

/** Coarse Mooves expire 3am after their window closes, matching the green chips. */
export function coarseExpiry(mode: PlanTimeMode, now: Date = new Date()): Date {
  const end = coarseSortAt(mode, now)
  return new Date(end.getTime() + GRACE_HOURS * 60 * 60 * 1000)
}

/** Guard so a Monday "this week" and a Saturday "this weekend" stay sensible. */
export function isWeekModeAvailable(now: Date = new Date()): boolean {
  const day = now.getDay()
  return day >= MONDAY && day < FRIDAY
}

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
export function planTile(
  startAt: Date,
  hasTime: boolean,
  mode: PlanTimeMode = hasTime ? 'datetime' : 'date',
): { top: string; bottom: string } {
  // Coarse Mooves say so on the tile rather than showing a date they don't have.
  if (mode === 'tonight') return { top: 'TO', bottom: 'NIGHT' }
  if (mode === 'week') return { top: 'THIS', bottom: 'WEEK' }
  if (mode === 'weekend') return { top: 'THIS', bottom: 'WEEKEND' }
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
  mode: PlanTimeMode = hasTime ? 'datetime' : 'date',
): string {
  const place = locationText?.trim()

  if (isCoarse(mode)) {
    const when = TIME_MODE_LABEL[mode]
    return place ? `${when}, ${place}` : `${when}, no place yet`
  }

  const day = relativeDay(startAt, now)
  if (place) return `${day}, ${place}`
  return hasTime ? day : `${day}, no set time`
}

/** Has this Moove dropped out of the feed already? */
export function isPlanOver(startAt: string, hasTime: boolean, now: Date = new Date()): boolean {
  const d = new Date(startAt)
  if (Number.isNaN(d.getTime())) return true
  return computePlanExpiry(d, hasTime).getTime() <= now.getTime()
}
