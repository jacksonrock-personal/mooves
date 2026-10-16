// R35 — server-side calendar helpers: the feed credential, and turning plan
// rows into calendar input. SERVER ONLY (node:crypto, service-role queries).
//
// A subscribed calendar cannot log in, so the feed URL is the credential. It is
// built from two halves:
//
//   <nonce><tag>
//   nonce = 32 random bytes, base64url (43 chars), stored in users.calendar_token
//   tag   = HMAC-SHA256(secret, "mooves-calendar-v1:" + nonce), base64url,
//           first 22 chars (132 bits)
//
// Why not just the nonce: public.users is readable by friends under RLS
// (users_select_friends) and its UPDATEs are broadcast over the feed's realtime
// subscription, so a bare token in that column would be one friend's devtools
// away from someone else's calendar. The tag never touches the database, so a
// leaked column value is not a working URL.
//
// Reset replaces the nonce, which changes both halves; the old URL then fails
// the lookup and 404s.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { createServiceClient } from '@/lib/supabase/server'
import { DEFAULT_APP_URL, type CalendarPlanInput } from '@/lib/calendar'

type Service = ReturnType<typeof createServiceClient>

/** The columns every calendar path selects from `plans`. */
export const CALENDAR_PLAN_COLUMNS =
  'id, author_id, title, start_at, has_time, time_mode, location_text, note, created_at, updated_at, cancelled_at'

export interface CalendarPlanRow {
  id: string
  author_id: string
  title: string
  start_at: string
  has_time: boolean
  time_mode: string
  location_text: string | null
  note: string | null
  created_at: string
  updated_at: string
  cancelled_at: string | null
}

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL
}

/**
 * Plan rows → calendar input, with "who's in" resolved. Joiners come from
 * move_joins WHERE plan_id = the plan (never the plan_id IS NULL green rows),
 * and the calendar's owner is left out of their own list.
 */
export async function toCalendarInputs(
  supabase: Service,
  rows: CalendarPlanRow[],
  ownerId: string,
): Promise<CalendarPlanInput[]> {
  if (rows.length === 0) return []
  const ids = rows.map(r => r.id)
  const { data: joins } = await supabase
    .from('move_joins')
    .select('plan_id, joiner_id, created_at')
    .in('plan_id', ids)
    .order('created_at', { ascending: true })

  const byPlan = new Map<string, string[]>()
  for (const j of joins ?? []) {
    if (!j.plan_id) continue
    const list = byPlan.get(j.plan_id) ?? []
    list.push(j.joiner_id)
    byPlan.set(j.plan_id, list)
  }

  const people = new Set<string>(rows.map(r => r.author_id))
  for (const list of byPlan.values()) list.forEach(id => people.add(id))
  const { data: users } = await supabase
    .from('users')
    .select('id, display_name')
    .in('id', [...people])
  const names = new Map((users ?? []).map(u => [u.id, u.display_name]))

  return rows.map(r => {
    const inIds = [r.author_id, ...(byPlan.get(r.id) ?? []).filter(id => id !== r.author_id)]
    return {
      id: r.id,
      title: r.title,
      startAt: r.start_at,
      hasTime: r.has_time,
      timeMode: r.time_mode,
      locationText: r.location_text,
      note: r.note,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      whosIn: inIds.flatMap(id => {
        const n = id === ownerId ? null : names.get(id)
        return n ? [n] : []
      }),
    }
  })
}

const NONCE_LEN = 43
const TAG_LEN = 22
export const FEED_TOKEN_LEN = NONCE_LEN + TAG_LEN

function secret(): string {
  const s = process.env.CALENDAR_TOKEN_SECRET || process.env.SUPABASE_JWT_SECRET
  if (!s) throw new Error('No secret configured for calendar tokens')
  return s
}

function tagFor(nonce: string): string {
  return createHmac('sha256', secret())
    .update(`mooves-calendar-v1:${nonce}`)
    .digest('base64url')
    .slice(0, TAG_LEN)
}

/** A fresh value for users.calendar_token. */
export function mintNonce(): string {
  return randomBytes(32).toString('base64url')
}

/** The URL token for a stored nonce. */
export function feedTokenFor(nonce: string): string {
  return `${nonce}${tagFor(nonce)}`
}

/**
 * Split and verify a URL token. Returns the nonce to look up, or null when the
 * token is malformed or its tag is wrong, in which case the caller answers 404
 * without touching the database.
 */
export function verifyFeedToken(token: string): string | null {
  if (token.length !== FEED_TOKEN_LEN || !/^[A-Za-z0-9_-]+$/.test(token)) return null
  const nonce = token.slice(0, NONCE_LEN)
  const given = Buffer.from(token.slice(NONCE_LEN))
  const expected = Buffer.from(tagFor(nonce))
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  return nonce
}
