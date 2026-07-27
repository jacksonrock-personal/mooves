'use client'

// Phase 20.5 — you joined a friend's green while green yourself.
//
// NEVER automatic. It only appears when your own green has ZERO joiners and the
// time buckets match. The zero-joiners guard is the hard one: going grey deletes
// move_joins, so prompting someone who has joiners would be inviting them to
// silently destroy other people's commitments.
//
// Greens only, never Mooves: joining Saturday's climbing has nothing to say
// about whether you are free tonight.

import { posthog } from '@/lib/posthog'

interface JoinWhileGreenSheetProps {
  friendName: string
  onDropMine: () => void
  onKeepBoth: () => void
}

export default function JoinWhileGreenSheet({
  friendName,
  onDropMine,
  onKeepBoth,
}: JoinWhileGreenSheetProps) {
  return (
    <>
      <div className="fixed inset-0 bg-text-primary/50 z-40" onClick={onKeepBoth} aria-hidden="true" />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-card-white rounded-t-3xl px-5 pt-3 [--safe-pb-base:1.875rem] safe-area-pb"
        role="dialog"
        aria-modal="true"
      >
        <div className="w-9 h-1 rounded-full bg-[#E8E4F5] mx-auto mb-4" />
        <h2 className="font-display font-extrabold text-[18px] text-text-primary tracking-tight mb-1.5">
          You&apos;re in with {friendName}.
        </h2>
        <p className="font-sans text-[13.5px] text-text-secondary leading-relaxed mb-5">
          You&apos;re still showing as free yourself. Want to drop your own move, so friends see one
          plan instead of two?
        </p>
        <button
          onClick={() => {
            posthog.capture('join_while_green_dropped')
            onDropMine()
          }}
          className="w-full py-[15px] rounded-2xl bg-purple-500 text-white font-display font-extrabold text-[15.5px] tracking-tight shadow-[0_6px_18px_rgba(124,92,219,0.3)] mb-2"
        >
          Drop mine
        </button>
        <button
          onClick={() => {
            posthog.capture('join_while_green_kept')
            onKeepBoth()
          }}
          className="w-full py-3.5 rounded-2xl bg-surface-bg text-text-secondary font-sans font-semibold text-[15px]"
        >
          Keep both
        </button>
      </div>
    </>
  )
}
