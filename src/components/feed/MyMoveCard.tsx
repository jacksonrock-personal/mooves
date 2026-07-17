'use client'

// Phase 9 — the mover's own active green session ("Your move"). Shows the time
// chip + note, live joiners, and (at 2+ joins) the group-chat blast button.
// A11y: green-tint card + green-700 label (never solid-green-on-white text).

import { timeLabel } from '@/components/go-green/TimeChips'
import Joiners, { type Joiner } from './Joiners'

interface MyMoveCardProps {
  statusNote: string | null
  statusTime: string | null
  joiners: Joiner[]
  meId: string
  onBlast: () => void
  onGoGrey: () => void
}

export default function MyMoveCard({
  statusNote,
  statusTime,
  joiners,
  meId,
  onBlast,
  onGoGrey,
}: MyMoveCardProps) {
  const time = timeLabel(statusTime)

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

      {joiners.length > 0 && (
        <div className="mt-3.5">
          <Joiners joiners={joiners} meId={meId} />
        </div>
      )}

      {joiners.length >= 2 && (
        <button
          onClick={onBlast}
          className="w-full mt-3.5 py-3.5 rounded-[14px] bg-purple-500 text-white font-display font-extrabold text-[15px] tracking-[-0.01em] flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(124,92,219,0.3)]"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          Start a group chat
        </button>
      )}

      <button
        onClick={onGoGrey}
        className="block w-full text-center mt-3 font-sans text-[13px] font-medium text-ink-500"
      >
        Tap to go grey
      </button>
    </div>
  )
}
