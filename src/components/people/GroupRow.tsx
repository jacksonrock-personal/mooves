'use client'

// Screen 9: a group row — emoji square + name + member count + chevron.
// Swipe left reveals Delete; tapping the row (without dragging) opens edit.
// Pointer-based so it works with touch and mouse-drag (desktop preview).

import { useRef, useState } from 'react'

const REVEAL_WIDTH = 72
const OPEN_THRESHOLD = 36

interface GroupRowProps {
  id: string
  name: string
  emoji: string
  memberCount: number
  onTap: (id: string) => void
  // Omitted for groups you don't own — those rows aren't swipe-to-delete.
  onDelete?: (id: string, name: string) => void
}

export default function GroupRow({ id, name, emoji, memberCount, onTap, onDelete }: GroupRowProps) {
  const swipeable = !!onDelete
  const [offset, setOffset] = useState(0) // 0 (closed) .. -REVEAL_WIDTH (open)
  const [dragging, setDragging] = useState(false)
  const startX = useRef(0)
  const startOffset = useRef(0)
  const moved = useRef(false)

  function handlePointerDown(e: React.PointerEvent) {
    if (!swipeable) return
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
    setOffset(offset <= -OPEN_THRESHOLD ? -REVEAL_WIDTH : 0)
  }

  function handleClick() {
    // A drag or an open reveal shouldn't count as a tap-to-edit.
    if (moved.current || offset !== 0) return
    onTap(id)
  }

  return (
    <div className="relative overflow-hidden border-b border-[#E8E4F5]">
      {onDelete && (
        <button
          onClick={() => onDelete(id, name)}
          className="absolute right-0 top-0 h-full w-[72px] flex items-center justify-center bg-[#E8405A] font-sans text-[13px] font-semibold text-white"
          aria-label={`Delete ${name}`}
          tabIndex={offset <= -OPEN_THRESHOLD ? 0 : -1}
        >
          Delete
        </button>
      )}
      <div
        className="relative flex items-center gap-[13px] px-5 py-3 bg-card-white touch-pan-y cursor-pointer"
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? 'none' : 'transform 0.22s ease',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
      >
        <div className="w-[42px] h-[42px] rounded-xl bg-purple-tint flex items-center justify-center text-[22px] leading-none shrink-0">
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-sans font-semibold text-[15px] text-text-primary truncate">
            {name}
          </p>
          <p className="font-sans text-[13px] text-text-secondary mt-px">
            {memberCount} {memberCount === 1 ? 'friend' : 'friends'}
          </p>
        </div>
        <span className="text-[#E8E4F5] text-[22px] font-light shrink-0">›</span>
      </div>
    </div>
  )
}
