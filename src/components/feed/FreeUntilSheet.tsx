'use client'

// Phase 20.7 — "Free until": make your own green's deadline visible and editable.
//
// Deliberately NOT on the swipe. 20.1 exists to make going free a single
// decision-free gesture, and a time picker inside it would put the decision
// straight back. Greens already auto-expire (9.5); this only surfaces and
// adjusts that deadline afterwards.
//
// It moves the deadline only — it never changes the time bucket, so a `now`
// green stays a `now` green and stays in the rail.

import { posthog } from '@/lib/posthog'
import { useSheetDrag } from '@/lib/useSheetDrag'

interface FreeUntilSheetProps {
  currentExpiresAt: string | null
  onPick: (iso: string) => void
  onClose: () => void
}

function fmt(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** Next 3:00 AM strictly after now, local — same rule the chips use. */
function next3am(from: Date): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 3, 0, 0, 0)
  if (d <= from) d.setDate(d.getDate() + 1)
  return d
}

export default function FreeUntilSheet({ currentExpiresAt, onPick, onClose }: FreeUntilSheetProps) {
  const now = new Date()
  const current = currentExpiresAt ? new Date(currentExpiresAt) : null
  const drag = useSheetDrag(onClose)

  // Presets first, because the point of this sheet is speed.
  const options = [
    { key: 'hour', label: 'Another hour', at: new Date(now.getTime() + 60 * 60 * 1000) },
    { key: 'tonight', label: 'Tonight', at: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 0, 0, 0) },
    { key: 'late', label: 'Late', at: next3am(now) },
  ].filter(o => o.at.getTime() > now.getTime())

  function isCurrent(at: Date): boolean {
    if (!current) return false
    return Math.abs(current.getTime() - at.getTime()) < 60 * 1000
  }

  return (
    <>
      <div className="fixed inset-0 bg-text-primary/50 z-40"
        style={{ opacity: drag.scrimOpacity }} onClick={onClose} aria-hidden="true" />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-card-white rounded-t-3xl px-5 pt-3 [--safe-pb-base:1.875rem] safe-area-pb"
        {...drag.sheetProps}
        role="dialog"
        aria-modal="true"
      >
        <div className="w-9 h-1 rounded-full bg-[#E8E4F5] mx-auto mb-4 cursor-grab" {...drag.handleProps} />
        <h2 className="font-display font-extrabold text-[18px] text-text-primary tracking-tight mb-1.5">
          Free until
        </h2>
        <p className="font-sans text-[13.5px] text-text-secondary leading-relaxed mb-4">
          Your move drops off on its own then, so nobody texts you about something that&apos;s over.
        </p>

        {options.map(o => (
          <button
            key={o.key}
            onClick={() => {
              posthog.capture('free_until_set', { preset: o.key })
              onPick(o.at.toISOString())
            }}
            className={`w-full flex items-center gap-3 rounded-2xl border-[1.5px] px-3.5 py-3.5 mb-2 text-left ${
              isCurrent(o.at) ? 'border-purple-500 bg-purple-100' : 'border-[#E8E4F5] bg-surface-bg'
            }`}
          >
            <span className="flex-1 font-sans text-[14.5px] font-semibold text-ink-900">{o.label}</span>
            <span className="font-sans text-[12.5px] text-text-secondary">{fmt(o.at)}</span>
            {isCurrent(o.at) && (
              <span className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center shrink-0">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
          </button>
        ))}

        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-2xl bg-surface-bg text-text-secondary font-sans font-semibold text-[15px] mt-1"
        >
          Never mind
        </button>
      </div>
    </>
  )
}
