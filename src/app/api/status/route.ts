// PATCH /api/status — go green or go grey

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const TIME_VALUES = ['now', 'tonight', 'weekend'] as const
type StatusTime = (typeof TIME_VALUES)[number]

function normalizeTime(value: unknown): StatusTime | null {
  return typeof value === 'string' && (TIME_VALUES as readonly string[]).includes(value)
    ? (value as StatusTime)
    : null
}

export async function PATCH(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    isAvailable: boolean
    statusNote?: string | null
    visibleTo?: string[] | null
    statusTime?: string | null
  }

  if (typeof body.isAvailable !== 'boolean') {
    return NextResponse.json({ error: 'isAvailable is required' }, { status: 400 })
  }

  type StatusUpdate = {
    is_available: boolean
    status_note: string | null
    visible_to: string[] | null
    status_time: StatusTime | null
    status_set_at: string
    last_green_at?: string
  }

  let updates: StatusUpdate
  if (!body.isAvailable) {
    updates = {
      is_available: false,
      status_note: null,
      visible_to: null,
      status_time: null,
      status_set_at: new Date().toISOString(),
    }
  } else {
    const note = body.statusNote?.trim() ?? null
    const now = new Date().toISOString()
    updates = {
      is_available: true,
      status_note: note && note.length > 0 ? note.slice(0, 60) : null,
      visible_to: body.visibleTo ?? null,
      status_time: normalizeTime(body.statusTime),
      status_set_at: now,
      last_green_at: now, // recent-green signal (10.1); never cleared on go-grey
    }
  }

  const supabase = createServiceClient()

  // Going grey ends the current move: clear any joins on it (9.2/9.4).
  if (!body.isAvailable) {
    await supabase.from('move_joins').delete().eq('mover_id', userId)
  }

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select('is_available, status_note, status_time')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  return NextResponse.json({
    isAvailable: data.is_available,
    statusNote: data.status_note,
    statusTime: data.status_time,
  })
}
