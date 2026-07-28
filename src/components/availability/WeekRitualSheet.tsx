'use client'

// Phase 22.3 — the weekly ritual.
//
// NOT a preset. Each week you set THAT week's availability, fresh, and nothing
// carries into the next one. A saved preset drifts out of true silently — it
// keeps asserting you are free Thursday evenings long after Thursdays changed,
// and every green it produces is a little less honest than the last. A week you
// set this week cannot drift.
//
// It comes to you on arrival rather than waiting behind a menu, which is also
// what keeps it clear of 17.3: a thing that meets you in a session you already
// chose to start is not a bid for your attention.
//
// Three ways out — the grabber, "Not this week", and the scrim — because PR #45
// found the Moove composer shipped at ~90% height with almost no scrim left to
// tap and no way to dismiss it.

import { useCallback, useEffect, useState } from 'react'
import { posthog } from '@/lib/posthog'
import { useSheetDrag } from '@/lib/useSheetDrag'
import {
  SLOT_LABEL,
  isDayPast,
  isSlotPast,
  slotColumns,
  toLocalDateStr,
  weekDates,
  type SlotPart,
} from '@/lib/availability'

interface WeekRitualSheetProps {
  open: boolean
  ritualDay: number
  /** How the sheet was reached, for the analytics property only. */
  source: 'arrival' | 'push' | 'settings'
  onClose: () => void
  /** "Not this week" — silences it until the next ritual day. */
  onDismiss: () => void
  onSaved: (slotCount: number) => void
}

type SlotKey = string // `${YYYY-MM-DD}:${part}`

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function WeekRitualSheet({
  open,
  ritualDay,
  source,
  onClose,
  onDismiss,
  onSaved,
}: WeekRitualSheetProps) {
  const [selected, setSelected] = useState<Set<SlotKey>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Whether this week already had slots when the sheet opened. Drives the title
  // and the secondary action: a week you have already set is edited, not created.
  const [hadSlots, setHadSlots] = useState(false)
  const drag = useSheetDrag(onClose)

  const days = weekDates(ritualDay)
  const from = toLocalDateStr(days[0])
  const to = toLocalDateStr(days[6])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/availability?from=${from}&to=${to}`)
      const data = (await res.json()) as { slots?: { date: string; part: string }[] }
      const keys = new Set((data.slots ?? []).map(s => `${s.date}:${s.part}`))
      setSelected(keys)
      setHadSlots(keys.size > 0)
    } catch {
      setError('Could not load your week.')
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    if (!open) return
    posthog.capture('week_ritual_opened', { source })
    void load()
  }, [open, source, load])

  if (!open) return null

  function toggle(dateStr: string, part: SlotPart) {
    setSelected(prev => {
      const next = new Set(prev)
      const key = `${dateStr}:${part}`
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function save(keys: Set<SlotKey>) {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const slots = [...keys].map(k => {
        const [date, part] = k.split(':')
        return { date, part }
      })
      const res = await fetch('/api/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, slots }),
      })
      if (!res.ok) throw new Error('save failed')
      posthog.capture('week_ritual_set', { slots: slots.length, source })
      onSaved(slots.length)
    } catch {
      setError('Could not save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const title = hadSlots ? 'Your week' : 'Set your week'
  const subtitle = hadSlots
    ? 'Tap to change anything.'
    : 'Tap the times you might be free. You can change any of it later.'

  return (
    <>
      <div
        className="fixed inset-0 bg-text-primary/50 z-40"
        style={{ opacity: drag.scrimOpacity }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[88%] flex-col rounded-t-3xl bg-surface-bg px-4 [--safe-pb-base:1.125rem] safe-area-pb"
        role="dialog"
        aria-modal="true"
        aria-label="Set your week"
        {...drag.sheetProps}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="mx-auto mb-3 mt-2.5 h-1 w-9 shrink-0 cursor-grab rounded-full bg-grey-300"
          {...drag.handleProps}
        />

        <h2 className="shrink-0 font-display text-[20px] font-extrabold tracking-tight text-ink-900">
          {title}
        </h2>
        <p className="mt-1 shrink-0 font-sans text-[12.5px] leading-relaxed text-ink-500">
          {subtitle}
        </p>

        {/* The privacy promise, on the surface where it is made. Nothing here is
            visible to anyone until a slot is confirmed and a real green exists. */}
        <span className="mt-2 flex w-fit shrink-0 items-center gap-1.5 rounded-full bg-grey-100 py-1.5 pl-2 pr-2.5 font-sans text-[11px] font-semibold text-ink-500">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Only you can see this
        </span>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col gap-1.5" aria-hidden="true">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-[38px] animate-pulse rounded-xl bg-grey-100" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {days.map(day => {
                const dateStr = toLocalDateStr(day)
                const weekday = day.getDay()
                const isWeekend = weekday === 0 || weekday === 6
                const dayDone = isDayPast(day)
                return (
                  <div
                    key={dateStr}
                    className={`flex items-center gap-1.5 ${dayDone ? 'opacity-30' : ''}`}
                  >
                    <span className="w-[42px] shrink-0">
                      <span
                        className={`block font-sans text-[12.5px] font-bold leading-tight ${
                          isWeekend ? 'text-purple-700' : 'text-ink-900'
                        }`}
                      >
                        {DAY_NAMES[weekday]}
                      </span>
                      <span className="block font-sans text-[10px] font-semibold leading-tight text-grey-300">
                        {day.getDate()}
                      </span>
                    </span>

                    {/* Always three columns, so Evening lines up on every row and a
                        weekday morning reads as nothing there rather than as a
                        control you are not allowed to touch. */}
                    {slotColumns(weekday).map((part, i) => {
                      if (!part) return <span key={i} className="h-[38px] flex-1" aria-hidden="true" />
                      const key = `${dateStr}:${part}`
                      const on = selected.has(key)
                      const spent = isSlotPast(day, part)
                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={spent || saving}
                          aria-pressed={on}
                          onClick={() => toggle(dateStr, part)}
                          className={`h-[38px] flex-1 rounded-xl border-[1.5px] font-sans text-[11.5px] transition-colors disabled:cursor-default ${
                            on
                              // Purple, never green. Green in this app means free
                              // NOW and visible to friends; a set slot is neither.
                              ? 'border-purple-500 bg-purple-100 font-bold text-purple-700'
                              : 'border-[#E8E4F5] bg-white font-semibold text-ink-500'
                          }`}
                        >
                          {SLOT_LABEL[part]}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {error && (
          <p className="mt-3 shrink-0 font-sans text-[12.5px] font-semibold text-red-500">{error}</p>
        )}

        <div className="mt-3 shrink-0 pt-1">
          <button
            onClick={() => void save(selected)}
            disabled={loading || saving}
            className="w-full rounded-2xl bg-purple-500 py-3.5 font-sans text-[15px] font-bold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : hadSlots ? 'Save changes' : 'Save your week'}
          </button>
          <button
            onClick={() => {
              if (hadSlots) {
                void save(new Set())
                return
              }
              posthog.capture('week_ritual_dismissed', { source })
              onDismiss()
            }}
            disabled={saving}
            className="mt-1.5 w-full rounded-2xl py-2.5 font-sans text-[13.5px] font-semibold text-ink-500 disabled:opacity-50"
          >
            {hadSlots ? 'Clear the week' : 'Not this week'}
          </button>
        </div>
      </div>
    </>
  )
}
