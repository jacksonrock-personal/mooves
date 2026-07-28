// Phase 20.3
// GET  /api/plans — the Mooves feed: every live Moove this viewer can see.
// POST /api/plans — create one.
//
// A Moove has a day, a green does not. `startAt` is required, `hasTime` says
// whether the author picked a clock time or only a date. Both timestamps are
// computed client-side from the author's local calendar (same architecture as
// green expiry, 9.5 Part A) because the server does not know their timezone —
// it only sanity-bounds what it is handed.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit, tooManyRequests } from '@/lib/ratelimit'
import { PLAN_TITLE_MAX, PLAN_LOCATION_MAX, PLAN_NOTE_MAX, type Plan } from '@/lib/plans'
import { sendPlanPush } from '@/lib/push'

// A Moove may be scheduled up to a year out; anything past that is a typo or an
// attempt to park a row in the feed forever.
const MAX_AHEAD_MS = 365 * 24 * 60 * 60 * 1000

const TIME_MODES = ['tonight', 'week', 'weekend', 'date', 'datetime']

function boundStartAt(value: unknown, now: Date): string | null {
  if (typeof value !== 'string') return null
  const t = new Date(value).getTime()
  if (Number.isNaN(t)) return null
  if (t > now.getTime() + MAX_AHEAD_MS) return null
  return new Date(t).toISOString()
}

function boundExpiresAt(value: unknown, startAt: string, now: Date): string {
  const start = new Date(startAt).getTime()
  if (typeof value === 'string') {
    const t = new Date(value).getTime()
    // Must be after the start and not absurdly far past it.
    if (!Number.isNaN(t) && t > start && t <= start + 48 * 60 * 60 * 1000) {
      return new Date(t).toISOString()
    }
  }
  // Fallback mirrors the Discover grace period.
  return new Date(Math.max(start, now.getTime()) + 3 * 60 * 60 * 1000).toISOString()
}

function trimmed(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const s = value.trim()
  return s.length > 0 ? s.slice(0, max) : null
}

export async function GET(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('get_plans', { viewer: userId })
  if (error) {
    console.error('get_plans failed:', error)
    return NextResponse.json({ error: 'Could not load' }, { status: 500 })
  }
  return NextResponse.json({ plans: (data as unknown as Plan[]) ?? [] })
}

export async function POST(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await checkRateLimit(`plans:create:${userId}`, 20, 3600))) return tooManyRequests()

  const body = (await req.json()) as {
    title?: string
    startAt?: string
    hasTime?: boolean
    timeMode?: string
    showGroups?: boolean
    expiresAt?: string
    locationText?: string | null
    note?: string | null
    visibleTo?: string[] | null
    sponsoredMoveId?: string | null
  }

  const title = trimmed(body.title, PLAN_TITLE_MAX)
  if (!title) return NextResponse.json({ error: 'A title is required' }, { status: 400 })

  const now = new Date()
  const startAt = boundStartAt(body.startAt, now)
  if (!startAt) return NextResponse.json({ error: 'A valid date is required' }, { status: 400 })

  const hasTime = body.hasTime !== false
  const visibleTo =
    Array.isArray(body.visibleTo) && body.visibleTo.length > 0 ? body.visibleTo : null

  const supabase = createServiceClient()

  // 13.8 — only attach an origin we can actually verify, so the "Sponsored"
  // disclosure on the friend feed can never be forged by a hand-built request.
  let sponsoredMoveId: string | null = null
  if (typeof body.sponsoredMoveId === 'string') {
    const { data: sm } = await supabase
      .from('sponsored_moves')
      .select('id')
      .eq('id', body.sponsoredMoveId)
      .eq('status', 'approved')
      .maybeSingle()
    if (sm) sponsoredMoveId = sm.id
  }

  const { data, error } = await supabase
    .from('plans')
    .insert({
      author_id: userId,
      title,
      start_at: startAt,
      has_time: hasTime,
      expires_at: boundExpiresAt(body.expiresAt, startAt, now),
      time_mode: TIME_MODES.includes(body.timeMode ?? '') ? body.timeMode! : 'datetime',
      // 18.2 rule: only meaningful when scoped to groups, since with everyone-
      // visibility there is no audience to name.
      show_groups: body.showGroups === true && !!visibleTo,
      location_text: trimmed(body.locationText, PLAN_LOCATION_MAX),
      note: trimmed(body.note, PLAN_NOTE_MAX),
      visible_to: visibleTo,
      sponsored_move_id: sponsoredMoveId,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('plan insert failed:', error)
    return NextResponse.json({ error: 'Could not post that' }, { status: 500 })
  }

  // 13.8 flywheel metric: count each time a sponsored move is brought to a
  // friend feed. Atomic; failure is logged, never surfaced.
  if (sponsoredMoveId) {
    const { error: bumpError } = await supabase.rpc('increment_brought_over', {
      p_move_id: sponsoredMoveId,
    })
    if (bumpError) console.error('brought_over increment failed:', bumpError)
  }

  // Group-scoped Mooves notify that group, under the same 60-minute per-group
  // cooldown as group-scoped greens. Never allowed to fail the write.
  if (visibleTo) {
    try {
      await sendPlanPush(userId, visibleTo, title, 'created')
    } catch {
      // best effort
    }
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
