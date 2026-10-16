// R35 — Add a Moove to your calendar.
//
// Pure functions only: no DB, no fetch, no Node APIs, so the same code builds
// the single-Moove .ics, the subscribed feed (both server-side) and the Google
// template link (client-side). Nothing calendar-shaped is ever RENDERED inside
// Mooves; this file only exports to the calendar people already use.
//
// RFC 5545 rules this file is responsible for:
//   - CRLF line endings, including after the last line
//   - lines folded at 75 OCTETS (not characters), continuation lines start
//     with one space, and a fold never splits a multi-byte UTF-8 character
//   - TEXT values escape backslash, semicolon, comma and newline
//
// Time mapping (spec):
//   date + time  → starts then, 2 hours long
//   date only    → all-day
//   tonight      → 19:00 to 22:00 in the viewer's timezone
//   this weekend → all-day, Saturday and Sunday
//   this week    → excluded until it has a date (returns null)

import type { Plan, PlanTimeMode } from '@/lib/plans'

/** The UID domain. Fixed, so an event keeps its identity across hosts. */
const UID_DOMAIN = 'makemooves.app'
export const DEFAULT_APP_URL = 'https://makemooves.app'
/** Same fallback the Discover route uses when a user's zone never landed. */
export const DEFAULT_TIMEZONE = 'America/Chicago'

const HOUR_MS = 60 * 60 * 1000
const TIMED_LENGTH_MS = 2 * HOUR_MS
const TONIGHT_START_HOUR = 19
const TONIGHT_END_HOUR = 22

/** Everything a calendar event needs to know about a Moove. */
export interface CalendarPlanInput {
  id: string
  title: string
  startAt: string
  hasTime: boolean
  timeMode: string
  locationText: string | null
  note: string | null
  /** Display names of the people in, already WITHOUT the calendar's owner. */
  whosIn: string[]
  createdAt?: string | null
  updatedAt?: string | null
}

export type EventTiming =
  | { kind: 'timed'; start: Date; end: Date }
  /** YYYYMMDD; `end` is exclusive, as RFC 5545 wants for VALUE=DATE. */
  | { kind: 'allDay'; start: string; end: string }

// ── Mode + timezone helpers ─────────────────────────────────────────────────

const MODES: PlanTimeMode[] = ['tonight', 'week', 'weekend', 'date', 'datetime']

/** An unknown stored mode falls back on has_time, the pre-coarse behaviour. */
export function normalizeMode(timeMode: string, hasTime: boolean): PlanTimeMode {
  return (MODES as string[]).includes(timeMode)
    ? (timeMode as PlanTimeMode)
    : hasTime
      ? 'datetime'
      : 'date'
}

/**
 * Whether a Moove can go on a calendar at all. The UI hides "Add to calendar"
 * when this is false, and the feed leaves the Moove out: an undated "This
 * week" has nothing to schedule yet.
 */
export function isCalendarable(plan: { timeMode: string; hasTime: boolean }): boolean {
  return normalizeMode(plan.timeMode, plan.hasTime) !== 'week'
}

export function isValidTimezone(tz: string | null | undefined): tz is string {
  if (!tz || tz.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export function safeTimezone(tz: string | null | undefined): string {
  return isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE
}

interface Ymd {
  y: number
  m: number
  d: number
}

/** Wall-clock parts of an instant in `tz`. */
function partsInTz(ms: number, tz: string): Ymd & { h: number; min: number; s: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const out = { y: 0, m: 0, d: 0, h: 0, min: 0, s: 0 }
  for (const p of fmt.formatToParts(new Date(ms))) {
    const n = Number(p.value)
    if (p.type === 'year') out.y = n
    else if (p.type === 'month') out.m = n
    else if (p.type === 'day') out.d = n
    else if (p.type === 'hour') out.h = n === 24 ? 0 : n
    else if (p.type === 'minute') out.min = n
    else if (p.type === 'second') out.s = n
  }
  return out
}

/** How far `tz` is ahead of UTC at instant `ms`, in ms. */
function tzOffsetMs(ms: number, tz: string): number {
  const p = partsInTz(ms, tz)
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s)
  return asUtc - Math.floor(ms / 1000) * 1000
}

/** The UTC instant at which the wall clock in `tz` reads y-m-d h:00. */
export function zonedTimeToUtc(day: Ymd, hour: number, tz: string): Date {
  const guess = Date.UTC(day.y, day.m - 1, day.d, hour, 0, 0)
  const first = guess - tzOffsetMs(guess, tz)
  // Second pass settles the answer on either side of a DST change.
  const second = guess - tzOffsetMs(first, tz)
  return new Date(second)
}

function addDays(day: Ymd, n: number): Ymd {
  const t = new Date(Date.UTC(day.y, day.m - 1, day.d + n))
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0')
const ymdString = (day: Ymd) => `${pad(day.y, 4)}${pad(day.m)}${pad(day.d)}`

/** 20261023T190000Z */
export function formatUtc(date: Date): string {
  return (
    `${pad(date.getUTCFullYear(), 4)}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  )
}

/**
 * Which calendar day a stored start_at means, in the viewer's zone.
 *
 * start_at is not a real start for the day-shaped modes, so it is ANCHORED
 * before reading the date:
 *   date only        → stored at the author's local midnight; read it at +12h
 *   tonight, weekend → stored at the END of the window (23:59:59 author-local,
 *                      it is a sort key, see coarseSortAt); read it at −12h
 * Either way the instant read lands mid-day for the author, so a friend up to
 * 11 hours east or west still sees the same calendar date the author meant.
 */
function anchoredDay(startAt: Date, mode: PlanTimeMode, tz: string): Ymd {
  const shift = mode === 'date' ? 12 * HOUR_MS : -12 * HOUR_MS
  const p = partsInTz(startAt.getTime() + shift, tz)
  return { y: p.y, m: p.m, d: p.d }
}

/** When the event sits on the calendar, or null when it cannot sit there yet. */
export function eventTiming(
  plan: Pick<CalendarPlanInput, 'startAt' | 'hasTime' | 'timeMode'>,
  timezone: string | null | undefined,
): EventTiming | null {
  const start = new Date(plan.startAt)
  if (Number.isNaN(start.getTime())) return null
  const mode = normalizeMode(plan.timeMode, plan.hasTime)
  const tz = safeTimezone(timezone)

  switch (mode) {
    case 'week':
      return null
    case 'datetime':
      return { kind: 'timed', start, end: new Date(start.getTime() + TIMED_LENGTH_MS) }
    case 'tonight': {
      const day = anchoredDay(start, mode, tz)
      return {
        kind: 'timed',
        start: zonedTimeToUtc(day, TONIGHT_START_HOUR, tz),
        end: zonedTimeToUtc(day, TONIGHT_END_HOUR, tz),
      }
    }
    case 'weekend': {
      // The sort key is the end of Sunday; the weekend is that Sunday and the
      // Saturday before it. DTEND is exclusive, so it is the Monday.
      const sunday = anchoredDay(start, mode, tz)
      return { kind: 'allDay', start: ymdString(addDays(sunday, -1)), end: ymdString(addDays(sunday, 1)) }
    }
    case 'date': {
      const day = anchoredDay(start, mode, tz)
      return { kind: 'allDay', start: ymdString(day), end: ymdString(addDays(day, 1)) }
    }
  }
}

// ── Text ────────────────────────────────────────────────────────────────────

/** RFC 5545 §3.3.11 TEXT escaping. */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

const encoder = new TextEncoder()

/** RFC 5545 §3.1 folding: 75 octets per line, continuation lines lead with a space. */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line
  const out: string[] = []
  let current = ''
  let bytes = 0
  // The first line holds 75 octets; every continuation spends one on its space.
  let limit = 75
  for (const ch of line) {
    const size = encoder.encode(ch).length
    if (bytes + size > limit) {
      out.push(current)
      current = ''
      bytes = 0
      limit = 74
    }
    current += ch
    bytes += size
  }
  out.push(current)
  return out.join('\r\n ')
}

/** "Chloe is in." · "Chloe and John are in." · "Chloe, John and 3 others are in." */
export function whosInLine(names: string[]): string | null {
  const n = names.filter(s => s.trim().length > 0)
  if (n.length === 0) return null
  if (n.length === 1) return `${n[0]} is in.`
  if (n.length === 2) return `${n[0]} and ${n[1]} are in.`
  if (n.length === 3) return `${n[0]}, ${n[1]} and ${n[2]} are in.`
  return `${n[0]}, ${n[1]} and ${n.length - 2} others are in.`
}

/** Where a calendar event links back to: the feed's own ?plan= deep link. */
export function planLink(planId: string, baseUrl: string = DEFAULT_APP_URL): string {
  return `${baseUrl.replace(/\/$/, '')}/feed?plan=${encodeURIComponent(planId)}`
}

/** The event body, as plain text: note, who's in, the link back. */
export function eventDescription(plan: CalendarPlanInput, baseUrl: string = DEFAULT_APP_URL): string {
  return [plan.note?.trim() || null, whosInLine(plan.whosIn), planLink(plan.id, baseUrl)]
    .filter((s): s is string => !!s)
    .join('\n')
}

/** "tacos-at-lupes" — for the .ics filename. */
export function planSlug(title: string): string {
  const s = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
  return s || 'moove'
}

// ── ICS ─────────────────────────────────────────────────────────────────────

export interface IcsOptions {
  /** The calendar owner's IANA zone; drives "tonight". */
  timezone: string | null | undefined
  baseUrl?: string
  now?: Date
}

/** One VEVENT as unfolded property lines, or null when it has no date yet. */
export function buildVevent(plan: CalendarPlanInput, opts: IcsOptions): string[] | null {
  const timing = eventTiming(plan, opts.timezone)
  if (!timing) return null
  const now = opts.now ?? new Date()
  const baseUrl = opts.baseUrl ?? DEFAULT_APP_URL

  const lines: string[] = [
    'BEGIN:VEVENT',
    // Stable UID = plan id, so an edited Moove updates in place rather than
    // landing on the calendar twice.
    `UID:${plan.id}@${UID_DOMAIN}`,
    `DTSTAMP:${formatUtc(now)}`,
  ]

  if (timing.kind === 'timed') {
    lines.push(`DTSTART:${formatUtc(timing.start)}`, `DTEND:${formatUtc(timing.end)}`, 'TRANSP:OPAQUE')
  } else {
    // All-day Mooves do not block the whole day as busy.
    lines.push(`DTSTART;VALUE=DATE:${timing.start}`, `DTEND;VALUE=DATE:${timing.end}`, 'TRANSP:TRANSPARENT')
  }

  const updated = plan.updatedAt ? new Date(plan.updatedAt) : null
  if (updated && !Number.isNaN(updated.getTime())) {
    lines.push(`LAST-MODIFIED:${formatUtc(updated)}`)
    // SEQUENCE must only ever go up. Seconds between creation and the latest
    // edit does exactly that without storing a counter.
    const created = plan.createdAt ? new Date(plan.createdAt) : null
    const seq =
      created && !Number.isNaN(created.getTime())
        ? Math.max(0, Math.floor((updated.getTime() - created.getTime()) / 1000))
        : 0
    lines.push(`SEQUENCE:${seq}`)
  }

  lines.push(`SUMMARY:${escapeText(plan.title)}`)
  const place = plan.locationText?.trim()
  if (place) lines.push(`LOCATION:${escapeText(place)}`)
  lines.push(`DESCRIPTION:${escapeText(eventDescription(plan, baseUrl))}`)
  lines.push(`URL:${planLink(plan.id, baseUrl)}`)
  lines.push('STATUS:CONFIRMED')

  // Spec: a reminder 1 hour before. An all-day event has no hour to count back
  // from (−1h would be 11pm the night before), so it gets what Apple itself
  // defaults to for all-day events: 9am on the day.
  lines.push(
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(plan.title)}`,
    timing.kind === 'timed' ? 'TRIGGER:-PT1H' : 'TRIGGER:PT9H',
    'END:VALARM',
    'END:VEVENT',
  )
  return lines
}

function wrapCalendar(events: string[][], feed: boolean): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mooves//Mooves Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]
  if (feed) {
    lines.push(
      'X-WR-CALNAME:Mooves',
      'X-WR-CALDESC:Mooves you started or joined',
      // Hints only; Google in particular refreshes on its own schedule.
      'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
      'X-PUBLISHED-TTL:PT1H',
    )
  }
  for (const e of events) lines.push(...e)
  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

/** The single-Moove .ics behind "Apple Calendar". Null for undated "This week". */
export function buildPlanIcs(plan: CalendarPlanInput, opts: IcsOptions): string | null {
  const event = buildVevent(plan, opts)
  return event ? wrapCalendar([event], false) : null
}

/** The subscribed feed. Undated Mooves are silently left out. */
export function buildFeedIcs(plans: CalendarPlanInput[], opts: IcsOptions): string {
  const events = plans.map(p => buildVevent(p, opts)).filter((e): e is string[] => e !== null)
  return wrapCalendar(events, true)
}

// ── Google ──────────────────────────────────────────────────────────────────

/**
 * Google's "create event" template link, prefilled. No reminder can be passed
 * through it, so the event gets the user's own default Google reminder, which
 * is exactly what the Add sheet's subline says.
 */
export function googleTemplateUrl(plan: CalendarPlanInput, opts: IcsOptions): string | null {
  const timing = eventTiming(plan, opts.timezone)
  if (!timing) return null
  const dates =
    timing.kind === 'timed'
      ? `${formatUtc(timing.start)}/${formatUtc(timing.end)}`
      : `${timing.start}/${timing.end}`
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: plan.title,
    dates,
    details: eventDescription(plan, opts.baseUrl ?? DEFAULT_APP_URL),
  })
  const place = plan.locationText?.trim()
  if (place) params.set('location', place)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** Google's "Add by URL" settings page, the only place a feed can be added. */
export const GOOGLE_ADD_BY_URL = 'https://calendar.google.com/calendar/u/0/r/settings/addbyurl'

// ── Client adapters ─────────────────────────────────────────────────────────

/** A feed Plan as calendar input, from the point of view of `meId`. */
export function calendarInputFromPlan(plan: Plan, meId: string): CalendarPlanInput {
  const people = [
    { id: plan.authorId, name: plan.authorName },
    ...plan.joiners.map(j => ({ id: j.id, name: j.displayName })),
  ]
  return {
    id: plan.id,
    title: plan.title,
    startAt: plan.startAt,
    hasTime: plan.hasTime,
    timeMode: plan.timeMode,
    locationText: plan.locationText,
    note: plan.note,
    whosIn: people.flatMap(p => (p.id !== meId && p.name ? [p.name] : [])),
  }
}

/** The subscribe URLs for a feed token, in both forms the UI hands out. */
export function feedUrls(token: string, baseUrl: string = DEFAULT_APP_URL): { https: string; webcal: string } {
  const https = `${baseUrl.replace(/\/$/, '')}/api/cal/${token}.ics`
  return { https, webcal: https.replace(/^https?:\/\//, 'webcal://') }
}
