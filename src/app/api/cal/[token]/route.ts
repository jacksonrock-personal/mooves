// R35
// GET /api/cal/<token>.ics — the subscribed calendar feed.
//
// Unauthenticated, because calendar apps cannot log in: the token IS the auth
// (middleware lists /api/cal/ as public for exactly this route). See
// lib/calendarServer for why the token is a stored nonce plus an HMAC tag, and
// why a malformed or forged one is refused before any query runs.
//
// Contents, per spec: Mooves this user AUTHORED or JOINED (a move_joins row
// with plan_id = the plan), not cancelled, start_at no older than 30 days, and
// not undated "This week". Leaving a Moove deletes the join row, so a left
// Moove simply stops appearing. Never Mooves merely visible to them.
//
// Any miss is a bare 404 with no body worth reading, so the response never says
// whether a token was once valid. Reset therefore makes an old URL 404.

import { createHash } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { buildFeedIcs, isCalendarable } from '@/lib/calendar'
import { checkRateLimit } from '@/lib/ratelimit'
import {
  CALENDAR_PLAN_COLUMNS,
  appUrl,
  toCalendarInputs,
  verifyFeedToken,
  type CalendarPlanRow,
} from '@/lib/calendarServer'

const WINDOW_DAYS = 30
const MAX_PLANS = 500
/** Calendar apps poll; a few an hour is normal, sixty is a loop. */
const FEED_LIMIT_PER_HOUR = 60

const notFound = () => new Response('Not found', { status: 404 })

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params
  const token = decodeURIComponent(raw).replace(/\.ics$/i, '')

  const nonce = verifyFeedToken(token)
  if (!nonce) return notFound()

  // Keyed on a hash, so the rate_limits table never holds a working URL.
  const key = createHash('sha256').update(token).digest('hex').slice(0, 32)
  if (!(await checkRateLimit(`cal:feed:${key}`, FEED_LIMIT_PER_HOUR, 3600))) {
    return new Response('Too many requests', { status: 429, headers: { 'Retry-After': '900' } })
  }

  const supabase = createServiceClient()
  const { data: user } = await supabase
    .from('users')
    .select('id, timezone')
    .eq('calendar_token', nonce)
    .maybeSingle()
  if (!user) return notFound()

  const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: joins } = await supabase
    .from('move_joins')
    .select('plan_id')
    .eq('joiner_id', user.id)
    .not('plan_id', 'is', null)
  const joinedIds = [...new Set((joins ?? []).flatMap(j => (j.plan_id ? [j.plan_id] : [])))]

  const [authored, joined] = await Promise.all([
    supabase
      .from('plans')
      .select(CALENDAR_PLAN_COLUMNS)
      .eq('author_id', user.id)
      .is('cancelled_at', null)
      .gte('start_at', cutoff)
      .order('start_at', { ascending: true })
      .limit(MAX_PLANS)
      .returns<CalendarPlanRow[]>(),
    joinedIds.length > 0
      ? supabase
          .from('plans')
          .select(CALENDAR_PLAN_COLUMNS)
          .in('id', joinedIds)
          .is('cancelled_at', null)
          .gte('start_at', cutoff)
          .order('start_at', { ascending: true })
          .limit(MAX_PLANS)
          .returns<CalendarPlanRow[]>()
      : Promise.resolve({ data: [] as CalendarPlanRow[], error: null }),
  ])

  if (authored.error || joined.error) {
    console.error('calendar feed query failed:', authored.error ?? joined.error)
    return new Response('Unavailable', { status: 503, headers: { 'Retry-After': '300' } })
  }

  const rows = new Map<string, CalendarPlanRow>()
  for (const r of [...(authored.data ?? []), ...(joined.data ?? [])]) {
    if (isCalendarable({ timeMode: r.time_mode, hasTime: r.has_time })) rows.set(r.id, r)
  }

  const inputs = await toCalendarInputs(supabase, [...rows.values()], user.id)
  const ics = buildFeedIcs(inputs, { timezone: user.timezone, baseUrl: appUrl() })

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="mooves.ics"',
      'Cache-Control': 'private, max-age=900',
    },
  })
}
