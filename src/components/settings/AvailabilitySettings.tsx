'use client'

// Phase 22.6 — Settings → Availability.
//
// Four rows, and one of them is deliberately not a control. The app now keeps a
// location-shaped fact about you, and the least it can do is show you what it
// is: the time zone row is read-only disclosure, not configuration.
//
// The reminder toggle and the ritual are SEPARATE. Turning the push off must
// never turn the feature off — "Set your week" keeps working and the ritual
// keeps launching on arrival on your chosen day.
//
// Confirm pushes get no switch of their own. They exist only because you set
// slots, so not setting slots is already the off switch; a toggle would let
// someone silently break their own week.

import { useEffect, useState } from 'react'
import Toggle from '@/components/ui/Toggle'
import { posthog } from '@/lib/posthog'
import WeekRitualSheet from '@/components/availability/WeekRitualSheet'
import { SLOT_LABEL, toLocalDateStr, weekDates, isSlotPart } from '@/lib/availability'

const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface AvailabilitySettingsProps {
  timezone: string | null
  weekRitualDay: number
  weekPushEnabled: boolean
}

export default function AvailabilitySettings({
  timezone,
  weekRitualDay,
  weekPushEnabled,
}: AvailabilitySettingsProps) {
  const [ritualDay, setRitualDay] = useState(weekRitualDay)
  const [pushOn, setPushOn] = useState(weekPushEnabled)
  const [dayPickerOpen, setDayPickerOpen] = useState(false)
  const [ritualOpen, setRitualOpen] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)

  // A one-line read of the week you have set, so the row says something true
  // rather than just naming itself. No count of weeks, no history — see the
  // hard wall in 22.0a.
  useEffect(() => {
    const days = weekDates(ritualDay)
    const from = toLocalDateStr(days[0])
    const to = toLocalDateStr(days[6])
    fetch(`/api/availability?from=${from}&to=${to}`)
      .then(r => r.json())
      .then((d: { slots?: { date: string; part: string }[] }) => {
        const slots = d.slots ?? []
        if (slots.length === 0) {
          setSummary('Nothing set this week')
          return
        }
        const labels = [
          ...new Set(
            slots
              .map(s => s.part)
              .filter(isSlotPart)
              .map(p => SLOT_LABEL[p]),
          ),
        ]
        setSummary(`${slots.length} ${slots.length === 1 ? 'time' : 'times'}, ${labels.join(' and ').toLowerCase()}`)
      })
      .catch(() => setSummary(null))
  }, [ritualDay, ritualOpen])

  async function patch(body: Record<string, unknown>) {
    try {
      await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch {
      // best-effort; the optimistic state stands
    }
  }

  function pickDay(day: number) {
    setRitualDay(day)
    setDayPickerOpen(false)
    posthog.capture('week_ritual_day_changed', { day })
    void patch({ weekRitualDay: day })
  }

  function togglePush(next: boolean) {
    setPushOn(next)
    posthog.capture(next ? 'week_push_enabled' : 'week_push_disabled')
    void patch({ weekPushEnabled: next })
  }

  return (
    <>
      <h2 className="font-sans text-[11px] font-bold uppercase tracking-[0.06em] text-ink-500 px-5 mb-2">
        Availability
      </h2>

      <div className="mx-4 overflow-hidden rounded-[20px] border border-[#E8E4F5] bg-white">
        <button
          onClick={() => setRitualOpen(true)}
          className="flex w-full items-center gap-2.5 p-4 text-left"
        >
          <span className="min-w-0">
            <span className="block font-sans text-[15px] font-bold text-ink-900">Set your week</span>
            <span className="mt-0.5 block font-sans text-[13px] text-ink-500">
              {summary ?? 'When you might be free'}
            </span>
          </span>
          <svg
            className="ml-auto shrink-0"
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="#BDB5D4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <div className="flex items-center gap-2.5 border-t border-[#E8E4F5] p-4 pr-3">
          <span className="min-w-0">
            <span className="block font-sans text-[15px] font-bold text-ink-900">Weekly reminder</span>
            <span className="mt-0.5 block font-sans text-[13px] text-ink-500">
              A nudge to set your week
            </span>
          </span>
          <span className="ml-auto">
            <Toggle on={pushOn} onChange={togglePush} label="Weekly reminder" />
          </span>
        </div>

        <button
          onClick={() => setDayPickerOpen(true)}
          className="flex w-full items-center gap-2.5 border-t border-[#E8E4F5] p-4 text-left"
        >
          <span className="font-sans text-[15px] font-bold text-ink-900">Reminder day</span>
          <span className="ml-auto font-sans text-[13px] font-semibold text-ink-500">
            {DAY_FULL[ritualDay]}
          </span>
          <svg
            className="shrink-0"
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="#BDB5D4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Disclosure, not a control. Captured silently from the browser and
            re-read on every app open, so a wrong guess corrects itself. */}
        <div className="flex items-center gap-2.5 border-t border-[#E8E4F5] p-4">
          <span className="min-w-0">
            <span className="block font-sans text-[15px] font-bold text-ink-900">Time zone</span>
            <span className="mt-0.5 block font-sans text-[13px] text-ink-500">Set by your phone</span>
          </span>
          <span className="ml-auto truncate font-sans text-[13px] text-grey-300">
            {timezone ?? 'Not set yet'}
          </span>
        </div>
      </div>

      {dayPickerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-text-primary/50"
            onClick={() => setDayPickerOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col gap-2 px-2 [--safe-pb-base:1.625rem] safe-area-pb">
            <div className="overflow-hidden rounded-2xl border border-[#E8E4F5] bg-surface-bg/95">
              <p className="border-b border-[#E8E4F5] px-3.5 py-2.5 text-center font-sans text-[12px] leading-relaxed text-ink-500">
                Which day should the reminder land, and the week start?
              </p>
              {DAY_FULL.map((name, i) => (
                <button
                  key={name}
                  onClick={() => pickDay(i)}
                  className={`w-full border-t border-[#E8E4F5] py-3.5 font-sans text-[17px] text-purple-500 first:border-t-0 ${
                    i === ritualDay ? 'font-extrabold' : 'font-semibold'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
            <button
              onClick={() => setDayPickerOpen(false)}
              className="w-full rounded-2xl border border-[#E8E4F5] bg-surface-bg/95 py-3.5 font-sans text-[17px] font-bold text-ink-900"
            >
              Never mind
            </button>
          </div>
        </>
      )}

      <WeekRitualSheet
        open={ritualOpen}
        ritualDay={ritualDay}
        source="settings"
        onClose={() => setRitualOpen(false)}
        onDismiss={() => setRitualOpen(false)}
        onSaved={() => setRitualOpen(false)}
      />
    </>
  )
}
