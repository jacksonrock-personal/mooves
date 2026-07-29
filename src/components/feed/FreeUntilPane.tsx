'use client'

// Phase 20.7's "Free until", converted from a bottom sheet into a PANE (R17).
//
// The presets and their rules are unchanged from FreeUntilSheet: it moves the
// deadline only, never the time bucket, so a `now` green stays a `now` green
// and stays in the rail. What changed is where it lives — it is now a pane of
// the green modal and of the Go Green sheet, rather than a sheet of its own
// stacked on top of one of them.
//
// R17 also gives it a second job: it is reachable BEFORE you commit, from the
// Go Green sheet, so the deadline is something you can see and adjust rather
// than something you discover afterwards.

import { posthog } from '@/lib/posthog'
import { PaneBack } from '@/components/ui/PaneTrack'

interface FreeUntilPaneProps {
  currentExpiresAt: string | null
  onPick: (iso: string) => void
  onBack: () => void
}

export function formatUntil(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** Next 3:00 AM strictly after now, local — same rule the chips use. */
function next3am(from: Date): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 3, 0, 0, 0)
  if (d <= from) d.setDate(d.getDate() + 1)
  return d
}

export default function FreeUntilPane({ currentExpiresAt, onPick, onBack }: FreeUntilPaneProps) {
  const now = new Date()
  const current = currentExpiresAt ? new Date(currentExpiresAt) : null

  // Presets first, because the point of this pane is speed.
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
      <div className="shrink-0 px-5 pb-1">
        <PaneBack onBack={onBack} label="Free until" />
        <p className="font-sans text-[13.5px] text-ink-500 leading-relaxed mb-4">
          Your move drops off on its own then, so nobody texts you about something that&apos;s over.
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5">
        {options.map(o => (
          <button
            key={o.key}
            type="button"
            onClick={() => {
              posthog.capture('free_until_set', { preset: o.key })
              onPick(o.at.toISOString())
            }}
            className={`w-full flex items-center gap-3 rounded-2xl border-[1.5px] px-3.5 py-3.5 mb-2 text-left ${
              isCurrent(o.at) ? 'border-purple-500 bg-purple-100' : 'border-[#E8E4F5] bg-surface-bg'
            }`}
          >
            <span className="flex-1 font-sans text-[14.5px] font-semibold text-ink-900">{o.label}</span>
            <span className="font-sans text-[12.5px] text-ink-500">
              {o.at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
            {isCurrent(o.at) && (
              <span className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center shrink-0">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="shrink-0 px-5 pt-3 [--safe-pb-base:1.625rem] safe-area-pb">
        <button
          type="button"
          onClick={onBack}
          className="w-full py-3.5 rounded-2xl bg-surface-bg text-ink-500 font-sans font-semibold text-[15px]"
        >
          Never mind
        </button>
      </div>
    </>
  )
}
