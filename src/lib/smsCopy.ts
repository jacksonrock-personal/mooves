// R37 — Text alerts: the pure, client-safe half.
//
// Everything here is plain functions over strings and Dates, so the opt-in
// component can import the consent version without pulling the service-role
// client into the browser bundle, and so the clock and copy rules can be tested
// without a database. The sending half lives in src/lib/sms.ts, which
// re-exports what callers need from here.

/**
 * The disclosure version a person agrees to when they tap "Yes, sign me up".
 * Bump it whenever the disclosure paragraph in TextAlertsOptIn changes, and
 * keep that paragraph identical to docs/compliance/sms-optin.html (the proof
 * Twilio reviewed).
 */
export const SMS_CONSENT_VERSION = '2026-10-16'

/** Recorded when someone texts START without ever having opted in on a screen. */
export const SMS_START_KEYWORD_VERSION = 'start-keyword'

/** The frequency promised to Twilio. Digest included. */
export const SMS_DAILY_CAP = 5

/** Recipient-local sending window: [08:00, 22:00). */
export const SMS_DAY_START_HOUR = 8
export const SMS_DAY_END_HOUR = 22

/** Used when a recipient has no stored zone (or a stale one). */
export const SMS_DEFAULT_TZ = 'America/Chicago'

/** Upper bound for a digest. Two GSM-7 segments are 306; ~320 is the spec's line. */
export const SMS_DIGEST_MAX = 320

export const SMS_HELP_TEXT =
  'Mooves alerts: texts when friends make a Moove, up to 5 msgs/day. Reply STOP to cancel. makemooves.app/terms'

// ── Keywords ────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'])
const START_WORDS = new Set(['START', 'UNSTOP'])
const HELP_WORDS = new Set(['HELP', 'INFO'])

/** "  stop. " → "STOP". Trim, uppercase, strip punctuation, collapse spaces. */
export function normalizeKeyword(body: string | null | undefined): string {
  return (body ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export type SmsKeyword = 'stop' | 'start' | 'help'

/** A whole-message keyword, or null for anything else (the feed check). */
export function classifyKeyword(body: string | null | undefined): SmsKeyword | null {
  const k = normalizeKeyword(body)
  if (STOP_WORDS.has(k)) return 'stop'
  if (START_WORDS.has(k)) return 'start'
  if (HELP_WORDS.has(k)) return 'help'
  return null
}

// ── Phone ───────────────────────────────────────────────────────────────────

/** E.164 "+13125550142" → "(312) 555-0142". Anything else comes back as-is. */
export function formatPhoneForDisplay(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (national.length !== 10) return phone
  return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`
}

// ── Recipient-local clock ───────────────────────────────────────────────────

/** A usable IANA zone: the stored one if Intl accepts it, else the default. */
export function smsZone(timezone: string | null | undefined): string {
  if (timezone) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone })
      return timezone
    } catch {
      // stale or nonsense name — fall through
    }
  }
  return SMS_DEFAULT_TZ
}

interface ZoneParts {
  year: number
  month: number // 1–12
  day: number
  hour: number
  minute: number
  second: number
  weekday: string // 'Mon'
  dateStr: string // 'YYYY-MM-DD'
}

function zoneParts(tz: string, at: Date): ZoneParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  const year = Number(get('year'))
  const month = Number(get('month'))
  const day = Number(get('day'))
  return {
    year,
    month,
    day,
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
    second: Number(get('second')),
    weekday: get('weekday'),
    dateStr: `${get('year')}-${get('month')}-${get('day')}`,
  }
}

/** The zone's UTC offset at `at`, in ms (local wall clock − UTC). */
function offsetMs(tz: string, at: Date): number {
  const p = zoneParts(tz, at)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(at.getTime() / 1000) * 1000
}

/**
 * The instant at which it is `hour`:00 on `dateStr` in `tz`. Two passes so the
 * offset used is the one in force AT the target, not at the guess — that is
 * what makes 08:00 right on the morning after a DST change.
 */
export function zonedTimeToUtc(dateStr: string, hour: number, tz: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  const wall = Date.UTC(y, m - 1, d, hour)
  const first = wall - offsetMs(tz, new Date(wall))
  const second = wall - offsetMs(tz, new Date(first))
  return new Date(second)
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}

/** Is it 08:00–21:59 for this recipient right now? */
export function isSmsDaytime(timezone: string | null | undefined, now: Date = new Date()): boolean {
  const h = zoneParts(smsZone(timezone), now).hour
  return h >= SMS_DAY_START_HOUR && h < SMS_DAY_END_HOUR
}

/** The next recipient-local 08:00 strictly ahead of an overnight `now`. */
export function nextSmsMorning(timezone: string | null | undefined, now: Date = new Date()): Date {
  const tz = smsZone(timezone)
  const p = zoneParts(tz, now)
  const day = p.hour < SMS_DAY_START_HOUR ? p.dateStr : addDays(p.dateStr, 1)
  return zonedTimeToUtc(day, SMS_DAY_START_HOUR, tz)
}

/** Recipient-local midnight today: where the 5-a-day count starts. */
export function smsLocalDayStart(timezone: string | null | undefined, now: Date = new Date()): Date {
  const tz = smsZone(timezone)
  return zonedTimeToUtc(zoneParts(tz, now).dateStr, 0, tz)
}

// ── {when} ──────────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}

function clockLabel(p: ZoneParts): string {
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12
  const mer = p.hour < 12 ? 'am' : 'pm'
  return p.minute === 0 ? `${h12}${mer}` : `${h12}:${String(p.minute).padStart(2, '0')}${mer}`
}

export interface SmsPlanTime {
  startAt: string
  hasTime: boolean
  timeMode: string | null
}

function coarseLabel(mode: string | null): string | null {
  if (mode === 'tonight') return 'tonight'
  if (mode === 'weekend') return 'this weekend'
  if (mode === 'week') return 'this week'
  return null
}

/**
 * The single alert's {when}, in the RECIPIENT's zone: "tonight 7pm",
 * "tomorrow 7pm", "Fri 7pm", "Nov 14", "this weekend".
 */
export function smsWhen(plan: SmsPlanTime, timezone: string | null | undefined, now: Date = new Date()): string {
  const coarse = coarseLabel(plan.timeMode)
  if (coarse) return coarse
  const tz = smsZone(timezone)
  const start = new Date(plan.startAt)
  if (Number.isNaN(start.getTime())) return 'soon'
  const s = zoneParts(tz, start)
  const diff = dayDiff(zoneParts(tz, now).dateStr, s.dateStr)

  let day: string
  if (diff === 0) day = plan.hasTime ? (s.hour >= 17 ? 'tonight' : 'today') : 'today'
  else if (diff === 1) day = 'tomorrow'
  else if (diff > 1 && diff < 7) day = s.weekday
  else day = `${MONTHS[s.month - 1]} ${s.day}`

  return plan.hasTime ? `${day} ${clockLabel(s)}` : day
}

/** The digest's short "(Fri)": a weekday inside the week, else "Nov 14". */
export function smsShortDay(plan: SmsPlanTime, timezone: string | null | undefined, now: Date = new Date()): string {
  const coarse = coarseLabel(plan.timeMode)
  if (coarse) return coarse
  const tz = smsZone(timezone)
  const start = new Date(plan.startAt)
  if (Number.isNaN(start.getTime())) return 'soon'
  const s = zoneParts(tz, start)
  const diff = dayDiff(zoneParts(tz, now).dateStr, s.dateStr)
  if (diff === 0) return 'today'
  if (diff > 0 && diff < 7) return s.weekday
  return `${MONTHS[s.month - 1]} ${s.day}`
}

// ── Copy ────────────────────────────────────────────────────────────────────

/** Full domain, never a shortener (carrier filtering). */
export function smsBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://makemooves.app').replace(/\/+$/, '')
}

function clip(s: string, max: number): string {
  const t = s.trim()
  // "..." rather than "…": one non-GSM character flips the whole text to UCS-2
  // and cuts a segment from 160 characters to 70.
  return t.length <= max ? t : `${t.slice(0, max - 3).trimEnd()}...`
}

export function singleAlertText(args: {
  authorName: string | null | undefined
  title: string
  when: string
  planId: string
  baseUrl?: string
}): string {
  const base = args.baseUrl ?? smsBaseUrl()
  const name = args.authorName?.trim() || 'A friend'
  return `Mooves: ${name} made a Moove, ${args.title.trim()}, ${args.when}. See who's in: ${base}/feed?plan=${args.planId} Reply STOP to opt out.`
}

/**
 * "Mooves: 2 new Mooves from friends: Tacos at Lupe's (Fri), Hike (Sun).
 *  https://makemooves.app/feed Reply STOP to opt out."
 *
 * N is always the true count. The list keeps as many items as fit under
 * SMS_DIGEST_MAX, then says "and K more"; long titles are clipped first so one
 * novel-length title cannot crowd out the rest.
 */
export function digestText(
  items: { title: string; day: string }[],
  baseUrl: string = smsBaseUrl(),
  max: number = SMS_DIGEST_MAX,
): string {
  const n = items.length
  const tail = ` ${baseUrl}/feed Reply STOP to opt out.`
  const head = `Mooves: ${n} new Mooves from friends: `
  const build = (k: number, titleMax: number) => {
    const shown = items.slice(0, k).map(i => `${clip(i.title, titleMax)} (${i.day})`)
    const rest = n - k
    const list = rest > 0 ? `${shown.join(', ')}, and ${rest} more` : shown.join(', ')
    return `${head}${list}.${tail}`
  }
  for (let k = n; k >= 1; k--) {
    const text = build(k, 40)
    if (text.length <= max) return text
  }
  // Even one item does not fit at 40: clip it to whatever room is left.
  const overhead = build(1, 40).length - clip(items[0]?.title ?? '', 40).length
  return build(1, Math.max(8, max - overhead))
}
