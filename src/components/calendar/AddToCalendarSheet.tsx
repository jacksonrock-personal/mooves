'use client'

// R35 — "Add to your calendar", for one Moove.
//
// Opens from the card's action row and from the Moove sheet, and only for the
// author or a joiner on a Moove that has a date. The Moove is restated at the
// top so you know exactly what you are adding.
//
// The sublines are honest about reminders, which is the recorded limit: the
// .ics carries our alert, Google's template link cannot, so a Google add gets
// whatever reminder that person already uses.
//
// The quieter link underneath swaps this sheet for Calendar sync, for people
// who would rather never do this one Moove at a time again.

import { useEffect, useState } from 'react'
import Sheet from '@/components/ui/Sheet'
import { posthog } from '@/lib/posthog'
import { browserTimezone } from '@/lib/timezone'
import { planTile, type Plan } from '@/lib/plans'
import {
  calendarInputFromPlan,
  eventTiming,
  googleTemplateUrl,
  normalizeMode,
  safeTimezone,
} from '@/lib/calendar'
import CalendarSyncSheet from './CalendarSyncSheet'
import { AppRow, AppTile, BodyPortal, RowGroup } from './parts'

export type AddToCalendarSource = 'card' | 'sheet'

interface AddToCalendarSheetProps {
  plan: Plan
  meId: string
  source: AddToCalendarSource
  onClose: () => void
}

/** "Friday, Oct 23 · 7:00 PM" · "Saturday, Oct 24" · "Tonight" · "This weekend" */
function whenLine(plan: Plan): string {
  const mode = normalizeMode(plan.timeMode, plan.hasTime)
  if (mode === 'tonight') return 'Tonight'
  if (mode === 'weekend') return 'This weekend'
  const d = new Date(plan.startAt)
  const day = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  if (mode !== 'datetime') return day
  return `${day} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

export default function AddToCalendarSheet({ plan, meId, source, onClose }: AddToCalendarSheetProps) {
  const [view, setView] = useState<'add' | 'sync'>('add')

  useEffect(() => {
    posthog.capture('calendar_add_opened', { source, time_mode: plan.timeMode })
  }, [source, plan.timeMode])

  const tz = safeTimezone(browserTimezone())
  const timing = eventTiming(plan, tz)
  const tile = planTile(new Date(plan.startAt), plan.hasTime, plan.timeMode)
  // The tiles show the day the event lands on, not today.
  const eventDay =
    timing?.kind === 'timed'
      ? timing.start
      : timing
        ? new Date(
            Number(timing.start.slice(0, 4)),
            Number(timing.start.slice(4, 6)) - 1,
            Number(timing.start.slice(6, 8)),
          )
        : new Date(plan.startAt)

  function handleApple() {
    posthog.capture('calendar_add_apple', { time_mode: plan.timeMode })
    // A plain navigation, not fetch + blob: iOS only offers its Add Event
    // sheet for a .ics it loads itself.
    window.location.href = `/api/plans/${encodeURIComponent(plan.id)}/ics?tz=${encodeURIComponent(tz)}`
    onClose()
  }

  function handleGoogle() {
    const url = googleTemplateUrl(calendarInputFromPlan(plan, meId), {
      timezone: tz,
      baseUrl: window.location.origin,
    })
    if (!url) return
    posthog.capture('calendar_add_google', { time_mode: plan.timeMode })
    window.open(url, '_blank', 'noopener,noreferrer')
    onClose()
  }

  if (view === 'sync') return <CalendarSyncSheet source="add_sheet" onClose={onClose} />

  return (
    <BodyPortal>
      <Sheet open onClose={onClose} className="pb-[30px]">
        <div className="flex gap-3 items-center px-5 pb-4 border-b border-grey-100">
          <div className="w-[50px] h-[50px] shrink-0 rounded-[13px] bg-purple-100 flex flex-col items-center justify-center gap-px px-0.5">
            <span className="font-display font-extrabold text-[13px] leading-none tracking-tight text-purple-700">
              {tile.top}
            </span>
            <span className="font-sans text-[8.5px] font-bold tracking-[0.04em] leading-none text-purple-700/75 text-center">
              {tile.bottom}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-[16px] leading-tight tracking-tight text-ink-900">
              {plan.title}
            </p>
            <p className="font-sans text-[13px] leading-[1.4] text-ink-500 mt-0.5">{whenLine(plan)}</p>
            {plan.locationText?.trim() && (
              <p className="font-sans text-[13px] leading-[1.4] text-ink-500">{plan.locationText.trim()}</p>
            )}
          </div>
        </div>

        <h2 className="font-display font-extrabold text-[16px] tracking-tight text-ink-900 px-5 pt-4">
          Add to your calendar
        </h2>

        <RowGroup className="mt-3">
          <AppRow
            tile={<AppTile kind="apple" date={eventDay} />}
            title="Apple Calendar"
            subtitle={
              timing?.kind === 'allDay' ? 'With a reminder that morning' : 'With a reminder 1 hour before'
            }
            onClick={handleApple}
          />
          <AppRow
            tile={<AppTile kind="google" date={eventDay} />}
            title="Google Calendar"
            subtitle="Uses your usual Google reminder"
            onClick={handleGoogle}
          />
        </RowGroup>

        <button
          onClick={() => setView('sync')}
          className="block mx-auto mt-[18px] font-sans text-[13.5px] font-semibold text-purple-500"
        >
          Sync all my Mooves instead
        </button>
      </Sheet>
    </BodyPortal>
  )
}
