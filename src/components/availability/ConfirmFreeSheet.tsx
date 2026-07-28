'use client'

// Phase 22.4 — the confirm.
//
// This is the whole point of the phase. Nothing was broadcast when you set your
// week and nothing is broadcast now until you tap: it CONFIRMS rather than
// auto-broadcasts, which was locked before the spec was written.
//
// What it produces is an ORDINARY green — the same PATCH /api/status the swipe
// makes, the same chip vocabulary, the same rail treatment, the same group push
// and the same wave eligibility. There is no "scheduled green" object and no
// badge saying it came from a schedule. Special-casing it would create two
// kinds of green, and the last three phases were spent collapsing exactly that
// sort of distinction.
//
// "Not today" is a plain dismiss that costs nothing and is never asked again.
// Silence does the same thing — an ignored slot produces no second push, no
// reminder and no card waiting for you later.

import { useState } from 'react'
import { posthog } from '@/lib/posthog'
import { useSheetDrag } from '@/lib/useSheetDrag'
import SheetGrabber from '@/components/ui/SheetGrabber'
import { SLOT_LABEL, greenForSlots, type SlotPart } from '@/lib/availability'

interface ConfirmFreeSheetProps {
  open: boolean
  /** Today's marked parts, earliest first. */
  parts: SlotPart[]
  /** 0 = Sunday … 6 = Saturday, for the "on Monday you marked Thursday" line. */
  ritualDay: number
  onClose: () => void
  onConfirmed: (statusTime: 'now' | 'tonight', expiresAt: string) => void
}

const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function ConfirmFreeSheet({
  open,
  parts,
  ritualDay,
  onClose,
  onConfirmed,
}: ConfirmFreeSheetProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const drag = useSheetDrag(onClose)

  if (!open || parts.length === 0) return null

  const today = new Date()

  async function confirm() {
    if (submitting) return
    const green = greenForSlots(parts)
    if (!green) return

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isAvailable: true,
          statusTime: green.statusTime,
          statusExpiresAt: green.expiresAt,
          // Everyone, which is what the swipe does today. 20.1's remembered
          // "Seen by {scope}" chip was specced and approved but never actually
          // built, so there is no last-used scope to reuse — inventing one here
          // would be this phase quietly shipping a different phase's feature.
          visibleTo: null,
          statusNote: null,
          statusShowGroups: false,
        }),
      })
      if (!res.ok) throw new Error('confirm failed')
      posthog.capture('availability_confirmed', {
        slots: parts.length,
        statusTime: green.statusTime,
      })
      onConfirmed(green.statusTime, green.expiresAt)
    } catch {
      setError('Could not do that. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-text-primary/50 z-40"
        style={{ opacity: drag.scrimOpacity }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-surface-bg px-4 [--safe-pb-base:1.125rem] safe-area-pb"
        role="dialog"
        aria-modal="true"
        aria-label="Free today?"
        {...drag.sheetProps}
      >
        <SheetGrabber
          drag={drag}
          onClose={onClose}
          className="mb-[18px] mt-[22px]"
          pillClassName="h-1 w-9 rounded-full bg-grey-300"
        />

        <h2 className="font-display text-[20px] font-extrabold tracking-tight text-ink-900">
          Free today?
        </h2>
        <p className="mt-1 font-sans text-[12.5px] leading-relaxed text-ink-500">
          On {DAY_FULL[ritualDay]} you marked {DAY_FULL[today.getDay()]} as a day you might be
          around.
        </p>

        <div className="mt-3.5 flex gap-1.5">
          {parts.map(p => (
            <span
              key={p}
              className="rounded-xl bg-purple-100 px-3 py-1.5 font-sans text-[12.5px] font-bold text-purple-700"
            >
              {SLOT_LABEL[p]}
            </span>
          ))}
        </div>

        {error && <p className="mt-3 font-sans text-[12.5px] font-semibold text-red-500">{error}</p>}

        <div className="mt-4">
          <button
            onClick={() => void confirm()}
            disabled={submitting}
            className="w-full rounded-2xl bg-purple-500 py-3.5 font-sans text-[15px] font-bold text-white disabled:opacity-50"
          >
            {submitting ? 'One moment…' : "Yes, I'm free"}
          </button>
          <button
            onClick={onClose}
            disabled={submitting}
            className="mt-1.5 w-full rounded-2xl py-2.5 font-sans text-[13.5px] font-semibold text-ink-500 disabled:opacity-50"
          >
            Not today
          </button>
        </div>
      </div>
    </>
  )
}
