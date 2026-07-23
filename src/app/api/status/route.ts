// PATCH /api/status — go green or go grey

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendGroupGreenPush, sendGreenWave } from '@/lib/push'

const TIME_VALUES = ['now', 'tonight', 'weekend'] as const
type StatusTime = (typeof TIME_VALUES)[number]

function normalizeTime(value: unknown): StatusTime | null {
  return typeof value === 'string' && (TIME_VALUES as readonly string[]).includes(value)
    ? (value as StatusTime)
    : null
}

// 9.5 Part A — the client computes the expiry on its local clock (the server
// can't know the user's 3am). Sanity-bound it: must be a valid future datetime
// no more than 8 days out, else fall back to +24h so every new green expires.
const MAX_EXPIRY_MS = 8 * 24 * 60 * 60 * 1000
function boundExpiresAt(value: unknown, now: Date): string {
  if (typeof value === 'string') {
    const t = new Date(value).getTime()
    if (!Number.isNaN(t) && t > now.getTime() && t <= now.getTime() + MAX_EXPIRY_MS) {
      return new Date(t).toISOString()
    }
  }
  return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
}

export async function PATCH(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    isAvailable: boolean
    statusNote?: string | null
    visibleTo?: string[] | null
    statusTime?: string | null
    statusMoveId?: string | null
    statusExpiresAt?: string | null
  }

  if (typeof body.isAvailable !== 'boolean') {
    return NextResponse.json({ error: 'isAvailable is required' }, { status: 400 })
  }

  type StatusUpdate = {
    is_available: boolean
    status_note: string | null
    visible_to: string[] | null
    status_time: StatusTime | null
    status_move_id: string | null
    status_set_at: string
    status_expires_at: string | null
    last_green_at?: string
  }

  const supabase = createServiceClient()

  // If going green anchored to a sponsored move (13.8 flywheel), validate it's a
  // real approved move before attaching.
  let anchoredMoveId: string | null = null
  if (body.isAvailable && typeof body.statusMoveId === 'string') {
    const { data: move } = await supabase
      .from('sponsored_moves')
      .select('id')
      .eq('id', body.statusMoveId)
      .eq('status', 'approved')
      .maybeSingle()
    if (move) anchoredMoveId = move.id
  }

  let updates: StatusUpdate
  if (!body.isAvailable) {
    updates = {
      is_available: false,
      status_note: null,
      visible_to: null,
      status_time: null,
      status_move_id: null,
      status_set_at: new Date().toISOString(),
      status_expires_at: null,
    }
  } else {
    const note = body.statusNote?.trim() ?? null
    const nowDate = new Date()
    const now = nowDate.toISOString()
    updates = {
      is_available: true,
      status_note: note && note.length > 0 ? note.slice(0, 60) : null,
      visible_to: body.visibleTo ?? null,
      status_time: normalizeTime(body.statusTime),
      status_move_id: anchoredMoveId,
      status_set_at: now,
      status_expires_at: boundExpiresAt(body.statusExpiresAt, nowDate), // 9.5 Part A
      last_green_at: now, // recent-green signal (10.1); never cleared on go-grey
    }
  }

  // Going grey ends the current move: clear any joins on it (9.2/9.4).
  if (!body.isAvailable) {
    await supabase.from('move_joins').delete().eq('mover_id', userId)
  }

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select('is_available, status_note, status_time, status_move_id')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  // Push on go-green. Awaited but never allowed to fail the status write.
  if (data.is_available) {
    try {
      // 17.1 green wave: a NAMED push to any friend who just reached 3 concurrent
      // greens. Fires regardless of scope (friends-at-large), returns who it reached.
      const waved = await sendGreenWave(userId)
      // 15.3 anonymous per-group push, minus anyone the wave already reached this
      // event (the escalation-ladder supersede).
      if (updates.visible_to && updates.visible_to.length > 0) {
        await sendGroupGreenPush(userId, updates.visible_to, waved)
      }
    } catch {
      // push is best-effort; the go-green already succeeded
    }
  }

  // Aggregate flywheel metric (13.8): count each time a move is brought to the feed.
  // Atomic increment (race-free) — replaces the old read-modify-write.
  if (anchoredMoveId) {
    const { error: bumpError } = await supabase.rpc('increment_brought_over', { p_move_id: anchoredMoveId })
    if (bumpError) console.error('brought_over increment failed:', bumpError)
  }

  return NextResponse.json({
    isAvailable: data.is_available,
    statusNote: data.status_note,
    statusTime: data.status_time,
    statusMoveId: data.status_move_id,
  })
}
