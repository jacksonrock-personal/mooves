// R35
// GET /api/plans/[id]/ics — one Moove as a .ics file, behind "Apple Calendar".
//
// Author or joiner only. Everyone else gets 404, not 403: "Add to calendar" is
// never shown to someone who has not joined, and this route must not confirm
// that a Moove they cannot see exists. Joiners are read from move_joins WHERE
// plan_id = this plan, never the plan_id IS NULL green rows.
//
// ?tz=<IANA zone> is the browser's zone, so "tonight" lands at 7pm on the clock
// of the phone that is adding it. It falls back on the stored users.timezone,
// then on the app default.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { buildPlanIcs, isValidTimezone, planSlug } from '@/lib/calendar'
import {
  CALENDAR_PLAN_COLUMNS,
  appUrl,
  toCalendarInputs,
  type CalendarPlanRow,
} from '@/lib/calendarServer'

const notFound = () => NextResponse.json({ error: 'Not found' }, { status: 404 })

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const { data: plan } = await supabase
    .from('plans')
    .select(CALENDAR_PLAN_COLUMNS)
    .eq('id', id)
    .maybeSingle<CalendarPlanRow>()
  if (!plan || plan.cancelled_at) return notFound()

  if (plan.author_id !== userId) {
    const { data: join } = await supabase
      .from('move_joins')
      .select('id')
      .eq('plan_id', id)
      .eq('joiner_id', userId)
      .maybeSingle()
    if (!join) return notFound()
  }

  const queryTz = new URL(req.url).searchParams.get('tz')
  let timezone: string | null = isValidTimezone(queryTz) ? queryTz : null
  if (!timezone) {
    const { data: me } = await supabase.from('users').select('timezone').eq('id', userId).maybeSingle()
    timezone = me?.timezone ?? null
  }

  const [input] = await toCalendarInputs(supabase, [plan], userId)
  const ics = input ? buildPlanIcs(input, { timezone, baseUrl: appUrl() }) : null
  // An undated "This week" has nothing to schedule. The button is hidden for
  // it, so reaching here means a stale card; say so plainly.
  if (!ics) return NextResponse.json({ error: 'This Moove has no date yet' }, { status: 409 })

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${planSlug(plan.title)}.ics"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
