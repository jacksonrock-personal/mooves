// PATCH /api/status — go green or go grey

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function PATCH(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    isAvailable: boolean
    statusNote?: string | null
    visibleTo?: string[] | null
  }

  if (typeof body.isAvailable !== 'boolean') {
    return NextResponse.json({ error: 'isAvailable is required' }, { status: 400 })
  }

  type StatusUpdate = {
    is_available: boolean
    status_note: string | null
    visible_to: string[] | null
    status_set_at: string
  }

  let updates: StatusUpdate
  if (!body.isAvailable) {
    updates = { is_available: false, status_note: null, visible_to: null, status_set_at: new Date().toISOString() }
  } else {
    const note = body.statusNote?.trim() ?? null
    updates = {
      is_available: true,
      status_note: note && note.length > 0 ? note.slice(0, 60) : null,
      visible_to: body.visibleTo ?? null,
      status_set_at: new Date().toISOString(),
    }
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select('is_available, status_note')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  return NextResponse.json({
    isAvailable: data.is_available,
    statusNote: data.status_note,
  })
}
