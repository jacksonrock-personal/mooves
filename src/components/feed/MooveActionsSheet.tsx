'use client'

// Phase 20.9 — the "···" action sheet on your own Moove, plus the cancel confirm.
//
// Native action-sheet styling, matching GoGreyConfirm and the FriendCard leave
// confirm rather than inventing a fourth pattern.
//
// The cancel confirm NAMES who is affected and says they will be told, because
// a Moove silently vanishing on people who committed to it is the one thing this
// phase refused to ship.

import { useState } from 'react'
import { posthog } from '@/lib/posthog'
import type { Plan } from '@/lib/plans'

interface MooveActionsSheetProps {
  plan: Plan
  onEdit: () => void
  onCancelled: () => void
  onClose: () => void
}

function joinerLine(plan: Plan): string {
  const names = plan.joiners.map(j => j.displayName ?? 'Someone')
  if (names.length === 0) return 'Nobody is in yet.'
  if (names.length === 1) return `${names[0]} is in.`
  if (names.length === 2) return `${names[0]} and ${names[1]} are in.`
  return `${names.slice(0, 2).join(', ')}, and ${names.length - 2} more are in.`
}

export default function MooveActionsSheet({
  plan,
  onEdit,
  onCancelled,
  onClose,
}: MooveActionsSheetProps) {
  const [confirming, setConfirming] = useState(false)
  const [working, setWorking] = useState(false)

  async function handleCancel() {
    if (working) return
    setWorking(true)
    try {
      const res = await fetch(`/api/plans/${plan.id}`, { method: 'DELETE' })
      if (!res.ok) {
        setWorking(false)
        return
      }
      const data = (await res.json()) as { notified?: number }
      posthog.capture('plan_cancelled', { notified: data.notified ?? 0 })
      onCancelled()
    } catch {
      setWorking(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-text-primary/50 z-40" onClick={onClose} aria-hidden="true" />

      {confirming ? (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 bg-card-white rounded-t-3xl px-5 pt-3 [--safe-pb-base:1.875rem] safe-area-pb"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-9 h-1 rounded-full bg-[#E8E4F5] mx-auto mb-4" />
          <h2 className="font-display font-extrabold text-[18px] text-text-primary tracking-tight mb-1.5">
            Cancel this Moove?
          </h2>
          <p className="font-sans text-[13.5px] text-text-secondary leading-relaxed mb-5">
            {joinerLine(plan)}
            {plan.joiners.length > 0
              ? " They'll get a notification that it's off, and it disappears from everyone's feed."
              : " It disappears from everyone's feed."}
          </p>
          <button
            onClick={() => void handleCancel()}
            disabled={working}
            className="w-full py-3.5 rounded-2xl bg-[#FFF0F2] text-[#E8405A] font-sans font-semibold text-[15px] mb-2 disabled:opacity-50"
          >
            Cancel the Moove
          </button>
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl bg-surface-bg text-text-secondary font-sans font-semibold text-[15px]"
          >
            Keep it
          </button>
        </div>
      ) : (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-2 [--safe-pb-base:1.625rem] flex flex-col gap-2 safe-area-pb">
          <div className="rounded-2xl overflow-hidden border border-[#E8E4F5] bg-surface-bg/95 backdrop-blur-xl">
            <p className="font-sans text-[12px] font-medium text-text-secondary text-center px-4 pt-3 pb-2 border-b border-[#E8E4F5]">
              {plan.title}
            </p>
            <button
              onClick={onEdit}
              className="w-full py-4 font-sans text-[17px] font-semibold text-mooves-purple"
            >
              Edit this Moove
            </button>
            <button
              onClick={() => setConfirming(true)}
              className="w-full py-4 font-sans text-[17px] font-semibold text-[#E8405A] border-t border-[#E8E4F5]"
            >
              Cancel this Moove
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-full py-4 rounded-2xl border border-[#E8E4F5] bg-surface-bg/95 backdrop-blur-xl font-sans text-[17px] font-bold text-text-primary"
          >
            Never mind
          </button>
        </div>
      )}
    </>
  )
}
