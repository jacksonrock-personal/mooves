// Phase 22 — your own week.
//
// GET /api/availability  — your slots for the current week, plus the settings
//                          the ritual needs to render itself.
// PUT /api/availability  — replace the week wholesale.
//
// PRIVATE, and structurally so: every query here is scoped to the caller's own
// id and there is no route, anywhere, that returns another user's slots. That
// is what lets get_feed and get_plans stay closed in this phase — the two
// functions that have been silently broken twice are not touched at all.
//
// Dates arrive as 'YYYY-MM-DD' strings computed on the caller's local calendar,
// the same architecture as green expiry (9.5 Part A) and plans.start_at. The
// server sanity-bounds the range and stores what it is handed.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit, tooManyRequests } from '@/lib/ratelimit'
import { isSlotPart, partsForWeekday } from '@/lib/availability'

/** 'YYYY-MM-DD' and nothing else. */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidDateStr(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** Weekday of a 'YYYY-MM-DD' string, 0 = Sunday. Read as a plain calendar date. */
function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round(
    (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / (24 * 60 * 60 * 1000),
  )
}

export async function GET(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  const supabase = createServiceClient()

  const { data: me } = await supabase
    .from('users')
    .select('week_ritual_day, week_push_enabled, timezone')
    .eq('id', userId)
    .maybeSingle()

  let slots: { slot_date: string; part: string }[] = []
  if (isValidDateStr(from) && isValidDateStr(to) && daysBetween(from, to) >= 0) {
    const { data } = await supabase
      .from('availability_slots')
      .select('slot_date, part')
      .eq('user_id', userId)
      .gte('slot_date', from)
      .lte('slot_date', to)
      .order('slot_date', { ascending: true })
    slots = data ?? []
  }

  return NextResponse.json({
    slots: slots.map(s => ({ date: s.slot_date, part: s.part })),
    weekRitualDay: me?.week_ritual_day ?? 1,
    weekPushEnabled: me?.week_push_enabled ?? true,
    timezone: me?.timezone ?? null,
  })
}

export async function PUT(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await checkRateLimit(`availability:put:${userId}`, 30, 60 * 60))) {
    return tooManyRequests()
  }

  const body = (await req.json()) as {
    from?: string
    to?: string
    slots?: { date?: string; part?: string }[]
  }

  const { from, to } = body
  if (!isValidDateStr(from) || !isValidDateStr(to)) {
    return NextResponse.json({ error: 'from and to must be YYYY-MM-DD' }, { status: 400 })
  }
  const span = daysBetween(from, to)
  // The ritual is one week. Anything wider is a hand-built request trying to
  // clear or claim a larger range than the UI can express.
  if (span < 0 || span > 6) {
    return NextResponse.json({ error: 'range must be a single week' }, { status: 400 })
  }

  const incoming = Array.isArray(body.slots) ? body.slots : []
  // R26 — 21 cells, up from 16: three parts on all seven days. Nothing
  // legitimate exceeds it.
  if (incoming.length > 21) {
    return NextResponse.json({ error: 'too many slots' }, { status: 400 })
  }

  // Keep only well-formed slots that are inside the stated range AND are
  // actually offered on that weekday, so nothing can be smuggled in by a
  // hand-built request.
  //
  // R26 — a client that has not reloaded still sends 'afternoon'. It is folded
  // to 'day' rather than dropped: the two windows are identical, so honouring
  // it changes nobody's stated availability, and silently discarding a slot
  // somebody ticked is the worse failure. Dedupe runs AFTER the fold, so a
  // stale client sending both lands one row rather than colliding on the
  // unique index.
  const seen = new Set<string>()
  const rows: { user_id: string; slot_date: string; part: string }[] = []
  for (const raw of incoming) {
    const s = { ...raw, part: raw.part === 'afternoon' ? 'day' : raw.part }
    if (!isValidDateStr(s.date) || !isSlotPart(s.part)) continue
    if (daysBetween(from, s.date) < 0 || daysBetween(s.date, to) < 0) continue
    if (!partsForWeekday(weekdayOf(s.date)).includes(s.part)) continue
    const key = `${s.date}:${s.part}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({ user_id: userId, slot_date: s.date, part: s.part })
  }

  const supabase = createServiceClient()

  // Replace the week: clear the range, then insert. Saving an EMPTY week is a
  // real answer, not an error — "nothing this week" has to be as easy to say as
  // a full grid, or the ritual becomes something you cannot decline.
  const { error: delError } = await supabase
    .from('availability_slots')
    .delete()
    .eq('user_id', userId)
    .gte('slot_date', from)
    .lte('slot_date', to)

  if (delError) {
    console.error('availability: clear failed:', delError.message)
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }

  if (rows.length) {
    const { error: insError } = await supabase.from('availability_slots').insert(rows)
    if (insError) {
      console.error('availability: insert failed:', insError.message)
      return NextResponse.json({ error: 'Save failed' }, { status: 500 })
    }
  }

  return NextResponse.json({
    slots: rows.map(r => ({ date: r.slot_date, part: r.part })),
  })
}
