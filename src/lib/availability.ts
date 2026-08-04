// Phase 22 — scheduled availability: the slot vocabulary and the time math.
//
// Two audiences, deliberately in one file so they cannot drift apart:
//
//   • the CLIENT builds the week grid and derives the green a confirm makes,
//     on its own local clock, exactly as 9.5 Part A and plans.start_at already do;
//   • the SERVER (the cron route, and only the cron route) answers "what time
//     is it where this user is?" from their stored IANA zone.
//
// Nothing else on the server reads a timezone. Storing one did not move any
// existing computation off the client, and this file is not an invitation to.

// R26 — EVERY day offers a morning. Phase 22 withheld weekday mornings on the
// theory that "a weekday morning is not a slot this app's model has anything to
// do with"; people with shifted schedules, days off and freelance weeks say
// otherwise, and the asymmetry was also the one place the grid had to explain
// itself.
//
// That forced a second decision, because morning (08–12) and the old day
// (09–17) OVERLAP by three hours and a grid where two cells claim the same
// hours is a grid that cannot be read. So the parts are now three, uniform,
// and non-overlapping on all seven days:
//
//   morning 08–12 · day 12–17 · evening 17–23
//
// `day` NARROWS from 09–17 to 12–17 and `afternoon` RETIRES into it. That way
// round rather than the other, because "Morning / Day / Evening" is the
// vocabulary already on screen (R25's strip), and it now means the same window
// on every day of the week — which retires the one caveat R25 shipped with.
//
// Retiring `afternoon` cost 8 rows across 4 beta users, migrated in place.
// Retiring `day` would have cost none — there were zero `day` rows, ever, which
// is its own quiet verdict on a 09–17 weekday slot.

/**
 * `afternoon` is LEGACY and is never offered. It stays in the union, the
 * window map and the DB CHECK so a row written before the migration still
 * renders instead of crashing a grid; its window is identical to `day`'s.
 */
export const SLOT_PARTS = ['morning', 'day', 'afternoon', 'evening'] as const
export type SlotPart = (typeof SLOT_PARTS)[number]

/** The three parts actually offered, in the order they are drawn. */
export const OFFERED_PARTS = ['morning', 'day', 'evening'] as const

/** Local hour windows, half-open [start, end). */
export const SLOT_WINDOW: Record<SlotPart, { start: number; end: number }> = {
  morning: { start: 8, end: 12 },
  day: { start: 12, end: 17 },
  afternoon: { start: 12, end: 17 },
  evening: { start: 17, end: 23 },
}

export const SLOT_LABEL: Record<SlotPart, string> = {
  morning: 'Morning',
  day: 'Day',
  afternoon: 'Afternoon',
  evening: 'Evening',
}

/** The hour the scheduler aims at, local, with a one-hour grace window. */
export const PUSH_HOUR = 9
export const PUSH_GRACE_HOURS = 1

export function isSlotPart(value: unknown): value is SlotPart {
  return typeof value === 'string' && (SLOT_PARTS as readonly string[]).includes(value)
}

/**
 * Which parts a day offers. 0 = Sunday … 6 = Saturday.
 *
 * R26 — the same three, every day. The weekday/weekend split is gone, and with
 * it the `weekday` argument's only job; it is kept so every call site does not
 * have to change and so a future rule (holidays, per-user schedules) has
 * somewhere to live.
 *
 * The grid goes from 16 cells to 21. Phase 22 called 16 "the ceiling for
 * something that has to stay a few taps" — that ceiling was about the WEEKDAY
 * MORNING being absent, and a uniform 7×3 is quicker to scan than a ragged
 * 5×2 + 2×3 even though it holds five more cells.
 */
export function partsForWeekday(_weekday: number): SlotPart[] {
  return [...OFFERED_PARTS]
}

/**
 * Renders the grid column a part sits in, so Evening always lines up last.
 * No nulls any more — every column is a real control on every row — but the
 * signature keeps them so callers can go on rendering a spacer for a hole that
 * no longer occurs.
 */
export function slotColumns(_weekday: number): (SlotPart | null)[] {
  return [...OFFERED_PARTS]
}

// ── Local dates, client side ────────────────────────────────────────────────

/** 'YYYY-MM-DD' in the runtime's own local calendar (never UTC — toISOString lies). */
export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * The seven dates of the current week, starting at the most recent occurrence
 * of `ritualDay` on or before today. On the ritual day that is today → +6; the
 * day after, the ritual still opens on the same week with day one already spent.
 */
export function weekDates(ritualDay: number, from: Date = new Date()): Date[] {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const back = (start.getDay() - ritualDay + 7) % 7
  start.setDate(start.getDate() - back)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return d
  })
}

/** A slot is spent once its window has closed on the local clock. */
export function isSlotPast(date: Date, part: SlotPart, now: Date = new Date()): boolean {
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), SLOT_WINDOW[part].end, 0, 0, 0)
  return end.getTime() <= now.getTime()
}

/** Every part of `date` has closed. Drives the dimmed row on the missed state. */
export function isDayPast(date: Date, now: Date = new Date()): boolean {
  return partsForWeekday(date.getDay()).every(p => isSlotPast(date, p, now))
}

// ── What a confirm produces ─────────────────────────────────────────────────

export interface ConfirmedGreen {
  /** Maps onto the shipped status_time vocabulary — no new bucket is minted. */
  statusTime: 'now' | 'tonight'
  /** End of the LATEST confirmed slot, which is exactly the 20.7 model. */
  expiresAt: string
}

/**
 * Derive the ordinary green a confirm makes. No new object and no "scheduled"
 * flag: special-casing it would create two kinds of green, and the last three
 * phases were spent collapsing distinctions like that.
 *
 * Chip is `tonight` when the earliest confirmed slot is an evening, else `now`.
 * Both are states the rail already renders, evening greens included.
 *
 * Computed on the confirming device's clock, so it stays consistent with every
 * other expiry in the app.
 */
export function greenForSlots(parts: SlotPart[], now: Date = new Date()): ConfirmedGreen | null {
  if (parts.length === 0) return null

  const sorted = [...parts].sort((a, b) => SLOT_WINDOW[a].start - SLOT_WINDOW[b].start)
  const earliest = sorted[0]
  const latest = sorted.reduce((acc, p) => (SLOT_WINDOW[p].end > SLOT_WINDOW[acc].end ? p : acc), sorted[0])

  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), SLOT_WINDOW[latest].end, 0, 0, 0)
  // A confirm arriving after its own window closed still needs a live green;
  // an hour is enough to be useful and short enough to be honest.
  const expires = end.getTime() > now.getTime() ? end : new Date(now.getTime() + 60 * 60 * 1000)

  return {
    statusTime: earliest === 'evening' ? 'tonight' : 'now',
    expiresAt: expires.toISOString(),
  }
}

// ── Local time from a stored zone: the cron route only ──────────────────────

export interface LocalClock {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number
  hour: number
  minute: number
  /** 'YYYY-MM-DD' in that zone. */
  dateStr: string
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

/**
 * What time it is right now where this user is. Returns null for a missing or
 * unrecognised zone, which the caller treats as "skip this user" — never as an
 * error. An unparseable zone must not take the whole tick down.
 *
 * Uses the IANA name rather than a stored offset, so DST is handled by the
 * runtime rather than by us.
 */
export function localClock(timezone: string | null, at: Date = new Date()): LocalClock | null {
  if (!timezone) return null
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(at)

    const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
    const weekday = WEEKDAY_INDEX[get('weekday')]
    const year = get('year')
    const month = get('month')
    const day = get('day')
    const hour = Number(get('hour'))
    const minute = Number(get('minute'))

    if (weekday === undefined || !year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
      return null
    }
    return { weekday, hour, minute, dateStr: `${year}-${month}-${day}` }
  } catch {
    // Unknown zone (a stale name, or a browser that handed us nonsense).
    return null
  }
}

/**
 * Is this user inside today's send window? 09:00 up to but not including 10:00,
 * local.
 *
 * The window is an HOUR, not an instant, and that is what makes the job
 * self-healing: a tick that fails is retried by the next one fifteen minutes
 * later, up to four times, because the "already sent" stamp is only written
 * after a send succeeds.
 */
export function inPushWindow(clock: LocalClock): boolean {
  return clock.hour >= PUSH_HOUR && clock.hour < PUSH_HOUR + PUSH_GRACE_HOURS
}

/** 'YYYY-MM-DD' for `daysAhead` days after a zone-local date string. */
export function addDaysToDateStr(dateStr: string, daysAhead: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + daysAhead)
  return dt.toISOString().slice(0, 10)
}
