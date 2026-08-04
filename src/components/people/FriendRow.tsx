'use client'

// Screen 8: a single friend row with swipe-left-to-reveal Remove.
// Pointer-based so it works with both touch and mouse-drag (desktop preview).
//
// R25 — TAP opens the friend's week; swipe is untouched. The `moved` ref that
// already existed for the drag is what keeps the two apart: a pointer that
// travelled more than 4px was a swipe and must not also fire a tap, which is
// why the tap is on pointerup rather than on a click handler.
//
// The trailing chip is the count of slots they have set this week — a SCOPED
// count from friend_week_counts, so `null` means either "not set" or "not
// yours to see" and renders as nothing either way.

import { useRef, useState } from 'react'
import Avatar from '@/components/ui/Avatar'

const REVEAL_WIDTH = 68
const OPEN_THRESHOLD = 34

interface FriendRowProps {
  id: string
  displayName: string | null
  avatarUrl: string | null
  /** Slots set this week, scoped to the viewer. null = nothing to show. */
  weekCount?: number | null
  onRemove: (id: string, displayName: string | null) => void
  onOpenWeek: (id: string) => void
}

export default function FriendRow({
  id,
  displayName,
  avatarUrl,
  weekCount = null,
  onRemove,
  onOpenWeek,
}: FriendRowProps) {
  const [offset, setOffset] = useState(0) // 0 (closed) .. -REVEAL_WIDTH (open)
  const [dragging, setDragging] = useState(false)
  const startX = useRef(0)
  const startOffset = useRef(0)
  const moved = useRef(false)

  function handlePointerDown(e: React.PointerEvent) {
    startX.current = e.clientX
    startOffset.current = offset
    moved.current = false
    setDragging(true)
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging) return
    const delta = e.clientX - startX.current
    if (Math.abs(delta) > 4) moved.current = true
    const next = Math.min(0, Math.max(-REVEAL_WIDTH, startOffset.current + delta))
    setOffset(next)
  }

  function handlePointerUp() {
    if (!dragging) return
    setDragging(false)
    const open = offset <= -OPEN_THRESHOLD
    setOffset(open ? -REVEAL_WIDTH : 0)

    // A tap is a pointer that never travelled and left the row closed. If the
    // Remove drawer is showing, the first tap closes it and does nothing else —
    // opening a sheet out from under a revealed destructive action is how you
    // get an accidental Remove.
    if (!moved.current && !open && offset === 0) onOpenWeek(id)
  }

  return (
    <div className="relative overflow-hidden border-b border-[#E8E4F5]">
      <button
        onClick={() => onRemove(id, displayName)}
        className="absolute right-0 top-0 h-full w-[68px] flex items-center justify-center bg-[#E8405A] font-sans text-[13px] font-semibold text-white"
        aria-label={`Remove ${displayName ?? 'friend'}`}
        tabIndex={offset <= -OPEN_THRESHOLD ? 0 : -1}
      >
        Remove
      </button>
      <div
        className="relative flex items-center gap-[13px] px-5 py-3 bg-white touch-pan-y"
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? 'none' : 'transform 0.22s ease',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <Avatar src={avatarUrl} name={displayName} size={40} className="shrink-0" />
        <span className="flex-1 min-w-0 font-sans text-[15px] font-medium text-text-primary truncate">
          {displayName}
        </span>
        {weekCount !== null && weekCount > 0 && (
          <span className="shrink-0 font-sans text-[11.5px] font-bold text-purple-700 bg-purple-100 rounded-full px-2.5 py-1">
            {weekCount} this week
          </span>
        )}
      </div>
    </div>
  )
}
