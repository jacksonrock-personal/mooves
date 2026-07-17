'use client'

// Phase 9 (amendment A1) — swipe-to-go-green on the home feed. Sliding the thumb
// past the threshold opens the go-green sheet. Fully accessible fallback: the
// control is a real button, so tap / Enter / Space also open the sheet — the
// slide is never the only path (spec a11y requirement). The sheet's own "I'm
// free" button is the actual commit.

import { useRef } from 'react'

interface SwipeToGoGreenProps {
  onActivate: () => void
}

export default function SwipeToGoGreen({ onActivate }: SwipeToGoGreenProps) {
  const thumbRef = useRef<HTMLSpanElement>(null)
  const startXRef = useRef(0)
  const draggingRef = useRef(false)
  const movedRef = useRef(false)

  function maxX(): number {
    const track = thumbRef.current?.parentElement
    if (!track) return 0
    // track width minus thumb (50px) minus the 4px insets on each side
    return track.clientWidth - 50 - 8
  }

  function setX(px: number) {
    if (thumbRef.current) thumbRef.current.style.transform = `translateX(${px}px)`
  }

  function handleDown(e: React.PointerEvent<HTMLSpanElement>) {
    draggingRef.current = true
    movedRef.current = false
    startXRef.current = e.clientX
    thumbRef.current?.setPointerCapture(e.pointerId)
  }

  function handleMove(e: React.PointerEvent<HTMLSpanElement>) {
    if (!draggingRef.current) return
    const dx = Math.max(0, Math.min(maxX(), e.clientX - startXRef.current))
    if (dx > 5) movedRef.current = true
    setX(dx)
  }

  function handleUp(e: React.PointerEvent<HTMLSpanElement>) {
    if (!draggingRef.current) return
    draggingRef.current = false
    const reached = e.clientX - startXRef.current >= maxX() * 0.7
    setX(0)
    thumbRef.current?.releasePointerCapture(e.pointerId)
    if (reached) onActivate()
  }

  function handleClick() {
    // Suppress the click that follows a real drag (drag handles activation itself);
    // a plain tap has no drag, so it opens the sheet — the a11y fallback.
    if (movedRef.current) {
      movedRef.current = false
      return
    }
    onActivate()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Go free"
      className="relative w-full h-[58px] rounded-full overflow-hidden mb-5 flex items-center bg-green-700/10 border-[1.5px] border-green-700/20"
    >
      <span
        ref={thumbRef}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        className="absolute left-1 top-1 w-[50px] h-[50px] rounded-full bg-green-700 flex items-center justify-center shadow-[0_2px_8px_rgba(22,122,67,0.35)] touch-none"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 6 10 12 4 18" opacity="0.45" />
          <polyline points="10 6 16 12 10 18" />
        </svg>
      </span>
      <span className="w-full text-center pl-[46px] font-display font-extrabold text-[16px] text-green-700 tracking-[-0.01em]">
        Slide to go free
      </span>
    </button>
  )
}
