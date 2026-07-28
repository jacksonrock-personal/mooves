'use client'

// Phase 9 — the mover's own active green session ("Your move"). Shows the time
// chip + note, live joiners, and (at 2+ joins) the group-chat blast button.
// A11y: green-tint card + green-700 label (never solid-green-on-white text).

import { timeLabel } from '@/components/go-green/TimeChips'
import { type Joiner } from './Joiners'
import WhosIn from './WhosIn'
import AnchoredMoveCard, { type AnchoredMove } from './AnchoredMoveCard'
import GroupLabel from './GroupLabel'

interface MyMoveCardProps {
  statusNote: string | null
  statusTime: string | null
  /** 18.2 — every group you picked. Your own card, so nothing is filtered out. */
  visibleGroups?: string[]
  anchoredMove?: AnchoredMove | null
  joiners: Joiner[]
  meId: string
  /** 20.7 — when this green lapses. NULL = a legacy green that never expires. */
  statusExpiresAt?: string | null
  onEditExpiry?: () => void
  onBlast: () => void
  onGoGrey: () => void
}

function untilLabel(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function MyMoveCard({
  statusNote,
  statusTime,
  visibleGroups,
  anchoredMove,
  joiners,
  meId,
  statusExpiresAt,
  onEditExpiry,
  onBlast,
  onGoGrey,
}: MyMoveCardProps) {
  const time = timeLabel(statusTime)
  const until = untilLabel(statusExpiresAt)

  return (
    <div className="rounded-[20px] border-[1.5px] border-green-500/25 bg-green-500/[0.09] p-4 mb-5">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0 shadow-[0_0_0_4px_rgba(46,204,113,0.16)]" />
        <span className="font-display font-extrabold text-[16px] text-green-700 tracking-[-0.01em]">
          You&apos;re free
        </span>
        {time && (
          <span className="ml-auto font-sans text-[12px] font-semibold text-purple-700 bg-purple-100 px-2.5 py-1 rounded-full">
            {time}
          </span>
        )}
      </div>

      {statusNote && <p className="font-sans text-[14px] text-ink-500 mt-1">{statusNote}</p>}

      {(visibleGroups?.length ?? 0) > 0 && (
        <div className="mt-2">
          <GroupLabel groups={visibleGroups ?? []} />
        </div>
      )}

      {anchoredMove && <AnchoredMoveCard move={anchoredMove} />}

      {/* 20.7 — the deadline, visible and editable, on the card rather than in
          the swipe. Hidden for legacy greens that have no expiry at all. */}
      {onEditExpiry && until && (
        <button
          onClick={onEditExpiry}
          className="w-full flex items-center gap-2 mt-3 rounded-[13px] border border-[#E8E4F5] bg-surface-bg px-3 py-2.5 text-left"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="text-purple-500 shrink-0">
            <circle cx="12" cy="12" r="9" />
            <polyline points="12 7 12 12 15.5 14" />
          </svg>
          <span className="font-sans text-[12px] font-semibold text-ink-500">Free until</span>
          <span className="ml-auto font-sans text-[12.5px] font-semibold text-ink-900">{until}</span>
        </button>
      )}

      {/* Greens no longer carry joiners or a group blast — those moved to
          Mooves, which are the object you can actually commit to. This card is
          now only the things nobody else can do for you. */}
      <button
        onClick={onGoGrey}
        className="block w-full text-center mt-3 font-sans text-[13px] font-medium text-ink-500"
      >
        Tap to go grey
      </button>
    </div>
  )
}
