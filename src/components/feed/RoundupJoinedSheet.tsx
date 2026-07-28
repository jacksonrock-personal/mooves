'use client'

// Phase 19.1 — shown once, over the feed, right after an "add everyone here"
// join completes.
//
// This is the ONLY place Undo is offered. Without it, scanning the wrong code
// costs up to 25 separate unfriends. Dismissing the sheet retires Undo — after
// this moment the friendships are just friendships, and the ordinary unfriend
// is the way out.
//
// No green: this is not availability, so the confirmation is purple.

import { useState } from 'react'
import { posthog } from '@/lib/posthog'
import { useSheetDrag } from '@/lib/useSheetDrag'
import SheetGrabber from '@/components/ui/SheetGrabber'

interface RoundupJoinedSheetProps {
  code: string
  connectedCount: number
  onDismiss: () => void
  onUndone: (removedCount: number) => void
}

export default function RoundupJoinedSheet({
  code,
  connectedCount,
  onDismiss,
  onUndone,
}: RoundupJoinedSheetProps) {
  const [undoing, setUndoing] = useState(false)

  async function handleUndo() {
    if (undoing) return
    setUndoing(true)
    try {
      const res = await fetch(`/api/roundup-invite/${code}/undo`, { method: 'POST' })
      const data = (await res.json()) as { removedCount?: number }
      posthog.capture('roundup_undo', { removed: data.removedCount ?? 0 })
      onUndone(data.removedCount ?? 0)
    } catch {
      setUndoing(false)
    }
  }

  const n = connectedCount
  const drag = useSheetDrag(onDismiss)

  return (
    <>
      <div
        className="fixed inset-0 bg-text-primary/50 z-40"
        style={{ opacity: drag.scrimOpacity }}
        onClick={onDismiss}
        aria-hidden="true"
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-card-white rounded-t-3xl px-5 pt-3 [--safe-pb-base:1.875rem] safe-area-pb"
        role="dialog"
        aria-modal="true"
        {...drag.sheetProps}
      >
        <SheetGrabber drag={drag} className="mb-6" />

        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-3.5 rounded-full bg-purple-100 flex items-center justify-center">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#7C5CDB"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h2 className="font-display font-extrabold text-[20px] text-text-primary tracking-tight mb-2">
            You&apos;re in.
          </h2>
          <p className="font-sans text-[13px] text-text-secondary leading-relaxed max-w-[246px] mx-auto mb-5">
            You&apos;re now friends with {n} {n === 1 ? 'person' : 'people'}, so you&apos;ll see each
            other&apos;s moves.
          </p>
        </div>

        <button
          onClick={onDismiss}
          className="w-full py-[15px] rounded-2xl bg-mooves-purple text-white font-display font-extrabold text-[15.5px] tracking-tight shadow-[0_6px_18px_rgba(124,92,219,0.3)] mb-1.5"
        >
          See who&apos;s free
        </button>
        <button
          onClick={() => void handleUndo()}
          disabled={undoing}
          className="w-full py-3 rounded-2xl text-mooves-purple font-sans font-semibold text-[14px] disabled:opacity-50"
        >
          Undo, remove {n === 1 ? 'that person' : `those ${n}`}
        </button>
      </div>
    </>
  )
}
