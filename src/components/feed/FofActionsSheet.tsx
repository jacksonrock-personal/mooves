'use client'

// R29 — the sheet behind the "through Marcus" chip on a one-hop-out Moove.
//
// WHY THE CHIP OPENS THIS AT ALL. Drawing R29 against the real PlanCard found
// there is nowhere else for Hide to live: on somebody else's card the
// right-hand slot holds "I'm in", and the pressure valve must not displace the
// primary action. A long-press was the alternative and was rejected — an
// affordance-free gesture is a feature nobody finds, which is fatal for the one
// control that exists to be found in an uncomfortable moment.
//
// THE ORDER OF THE TWO THINGS IN HERE IS THE DESIGN. The common tap is "who IS
// this person?", not "make them go away", so the connection is stated first and
// plainly, and Hide is underneath it. A sheet that opened straight onto a
// destructive action would punish curiosity, and curiosity is the behaviour this
// whole round is trying to produce.
//
// Native action-sheet shape, matching MooveActionsSheet and GoGreyConfirm rather
// than inventing a fourth pattern.

import { useState } from 'react'
import { posthog } from '@/lib/posthog'
import { useSheetDrag } from '@/lib/useSheetDrag'
import SheetGrabber from '@/components/ui/SheetGrabber'
import type { Plan } from '@/lib/plans'

interface FofActionsSheetProps {
  plan: Plan
  onHidden: () => void
  onClose: () => void
}

export default function FofActionsSheet({ plan, onHidden, onClose }: FofActionsSheetProps) {
  const [confirming, setConfirming] = useState(false)
  const [working, setWorking] = useState(false)
  const confirmDrag = useSheetDrag(() => setConfirming(false))

  const who = plan.authorName ?? 'They'
  const via = plan.viaName ?? 'a friend'

  async function handleHide() {
    if (working) return
    setWorking(true)
    try {
      const res = await fetch(`/api/fof-hidden/${plan.authorId}`, { method: 'POST' })
      if (!res.ok) {
        setWorking(false)
        return
      }
      posthog.capture('fof_author_hidden')
      onHidden()
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
          {...confirmDrag.sheetProps}
        >
          <SheetGrabber drag={confirmDrag} className="mb-[22px]" />
          <h2 className="font-display font-extrabold text-[18px] text-text-primary tracking-tight mb-1.5">
            Hide Mooves from {who}?
          </h2>
          {/* Both reassurances are load-bearing, because both are the first
              thing anyone would wonder and getting either wrong would stop
              people using this. It does not touch the bridge, and it is not a
              message to the person being hidden. */}
          <p className="font-sans text-[13.5px] text-text-secondary leading-relaxed mb-5">
            You&apos;ll stop seeing Mooves {who} opens up to friends of friends. It doesn&apos;t
            affect {via}, and {who} isn&apos;t told. You can undo this in Settings.
          </p>
          <button
            onClick={() => void handleHide()}
            disabled={working}
            className="w-full py-3.5 rounded-2xl bg-[#FFF0F2] text-[#E8405A] font-sans font-semibold text-[15px] mb-2 disabled:opacity-50"
          >
            Hide {who}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="w-full py-3.5 rounded-2xl bg-surface-bg text-text-secondary font-sans font-semibold text-[15px]"
          >
            Never mind
          </button>
        </div>
      ) : (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-2 [--safe-pb-base:1.625rem] flex flex-col gap-2 safe-area-pb">
          <div className="rounded-2xl overflow-hidden border border-[#E8E4F5] bg-surface-bg/95 backdrop-blur-xl">
            {/* The answer to the tap, before any action. Not a heading — the
                thing the person came here to find out. */}
            <p className="font-sans text-[13px] text-text-primary text-center px-4 pt-4 pb-1 font-semibold">
              {who} is a friend of {via}
            </p>
            <p className="font-sans text-[12px] font-medium text-text-secondary text-center px-5 pb-3 leading-[1.45] border-b border-[#E8E4F5]">
              You&apos;re not friends on Mooves. {who} opened this Moove up so friends of their
              friends could come.
            </p>
            <button
              onClick={() => setConfirming(true)}
              className="w-full py-4 font-sans text-[17px] font-semibold text-[#E8405A]"
            >
              Hide Mooves from {who}
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
