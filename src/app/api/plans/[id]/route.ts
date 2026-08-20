// Phase 20.9
// PATCH  /api/plans/[id] — edit. Author only. Joiners are NOT notified (spec).
// DELETE /api/plans/[id] — cancel. Author only. Joiners ARE notified, because a
//                          Moove silently vanishing on people who committed to
//                          it is the one thing this phase refused to ship.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { PLAN_TITLE_MAX, PLAN_LOCATION_MAX, PLAN_NOTE_MAX } from '@/lib/plans'
import { sendPlanCancelledPush } from '@/lib/push'
import { sanitizeVisibleUserIds } from '@/lib/visibility'

const MAX_AHEAD_MS = 365 * 24 * 60 * 60 * 1000

/** Same whitelist the create route enforces. */
const TIME_MODES = ['tonight', 'week', 'weekend', 'date', 'datetime']

function trimmed(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const s = value.trim()
  return s.length > 0 ? s.slice(0, max) : null
}

async function requireAuthor(supabase: ReturnType<typeof createServiceClient>, planId: string, userId: string) {
  const { data } = await supabase
    .from('plans')
    // R29 pulls the audience columns too: this is a PARTIAL update, so the
    // narrowing-vs-widening rule has to be checked against the state the row
    // will END UP in, not against whatever this one request happened to mention.
    .select('id, author_id, title, cancelled_at, visible_to, visible_user_ids, open_to_fof')
    .eq('id', planId)
    .maybeSingle()
  if (!data) return { error: 'notfound' as const }
  if (data.author_id !== userId) return { error: 'forbidden' as const }
  if (data.cancelled_at) return { error: 'gone' as const }
  return { plan: data }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()
  const gate = await requireAuthor(supabase, id, userId)
  if ('error' in gate) {
    const status = gate.error === 'forbidden' ? 403 : 404
    return NextResponse.json({ error: 'Not yours to edit' }, { status })
  }

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
    /** R16 — individual friends, unioned with the groups above. */
    visibleUserIds?: string[] | null
    /** R29 — open this one Moove a single hop out. */
    openToFof?: boolean
  }

  type PlanUpdate = Database['public']['Tables']['plans']['Update']
  const updates: PlanUpdate = { updated_at: new Date().toISOString() }

  const title = trimmed(body.title, PLAN_TITLE_MAX)
  if (title) updates.title = title

  if (typeof body.startAt === 'string') {
    const t = new Date(body.startAt).getTime()
    if (Number.isNaN(t) || t > Date.now() + MAX_AHEAD_MS) {
      return NextResponse.json({ error: 'A valid date is required' }, { status: 400 })
    }
    updates.start_at = new Date(t).toISOString()
    if (typeof body.hasTime === 'boolean') updates.has_time = body.hasTime
    if (typeof body.expiresAt === 'string') {
      const e = new Date(body.expiresAt).getTime()
      if (!Number.isNaN(e) && e > t && e <= t + 48 * 60 * 60 * 1000) {
        updates.expires_at = new Date(e).toISOString()
      }
    }
  }

  // THE EDIT BUG. This route predates Phase 20's coarse timing and never caught
  // up: the composer has always sent `timeMode`, and this route has always
  // thrown it away. So changing a Moove from "this weekend" to Saturday 9am
  // wrote the new start_at, answered 200, and left time_mode reading 'weekend' —
  // the card kept rendering THIS WEEKEND and the edit looked like it did nothing.
  if (typeof body.timeMode === 'string' && TIME_MODES.includes(body.timeMode)) {
    updates.time_mode = body.timeMode
  }

  if ('locationText' in body) updates.location_text = trimmed(body.locationText, PLAN_LOCATION_MAX)
  if ('note' in body) updates.note = trimmed(body.note, PLAN_NOTE_MAX)
  if ('visibleTo' in body) {
    const visibleTo =
      Array.isArray(body.visibleTo) && body.visibleTo.length > 0 ? body.visibleTo : null
    updates.visible_to = visibleTo
    // 18.2's rule, matched to the create route: only meaningful when scoped to
    // groups, since with everyone-visibility there is no audience to name. Kept
    // in the same branch as visible_to so the pair can never drift apart —
    // show_groups true with visible_to null was reachable before this.
    updates.show_groups = body.showGroups === true && !!visibleTo
  }

  // R16 — its own `in body` guard, matching the one above. An edit that does not
  // mention the individual scope must LEAVE IT ALONE rather than null it out;
  // silently widening a Moove on save is precisely the R12 bug.
  if ('visibleUserIds' in body) {
    updates.visible_user_ids = await sanitizeVisibleUserIds(supabase, userId, body.visibleUserIds)
  }

  if ('openToFof' in body) updates.open_to_fof = body.openToFof === true

  // R29 — the same rejection as the create route, but resolved against the row
  // as it WILL BE. An edit that scopes a Moove to a group without mentioning
  // openToFof, on a Moove that is already open, is the case a request-only
  // check would wave through — and it is the likeliest one, because narrowing
  // an open Moove is exactly what somebody does when they change their mind.
  const finalGroups = 'visibleTo' in body ? updates.visible_to : gate.plan.visible_to
  const finalUsers = 'visibleUserIds' in body ? updates.visible_user_ids : gate.plan.visible_user_ids
  const finalOpen = 'openToFof' in body ? updates.open_to_fof : gate.plan.open_to_fof
  if (finalOpen && ((finalGroups?.length ?? 0) > 0 || (finalUsers?.length ?? 0) > 0)) {
    return NextResponse.json(
      { error: 'A Moove shared with a group or specific friends cannot also open to friends of friends' },
      { status: 400 },
    )
  }

  const { error } = await supabase.from('plans').update(updates).eq('id', id)
  if (error) {
    console.error('plan update failed:', error)
    return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  }
  return NextResponse.json({ saved: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()
  const gate = await requireAuthor(supabase, id, userId)
  if ('error' in gate) {
    const status = gate.error === 'forbidden' ? 403 : 404
    return NextResponse.json({ error: 'Not yours to cancel' }, { status })
  }

  // Collect joiners BEFORE cancelling — they are exactly who deserves telling.
  const { data: joins } = await supabase
    .from('move_joins')
    .select('joiner_id')
    .eq('plan_id', id)

  const joinerIds = (joins ?? []).map(j => j.joiner_id).filter(jid => jid !== userId)

  const { error } = await supabase
    .from('plans')
    .update({ cancelled_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('plan cancel failed:', error)
    return NextResponse.json({ error: 'Could not cancel' }, { status: 500 })
  }

  // Phase 21, wall 4 — comments die with the Moove. Cancelling is a soft flag on
  // `plans`, so the FK cascade never fires; the rows have to go explicitly or
  // they would outlive the thing they were about. Best effort: the API already
  // refuses to read them once cancelled_at is set, so a failure here leaves them
  // unreachable rather than exposed.
  const { error: commentsError } = await supabase.from('plan_comments').delete().eq('plan_id', id)
  if (commentsError) console.error('comment cleanup on cancel failed:', commentsError)

  if (joinerIds.length > 0) {
    try {
      await sendPlanCancelledPush(userId, joinerIds, gate.plan.title)
    } catch {
      // best effort; the cancel itself already succeeded
    }
  }

  return NextResponse.json({ cancelled: true, notified: joinerIds.length })
}
