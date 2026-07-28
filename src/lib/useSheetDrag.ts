'use client'

// R6 — swipe down to close, for every sheet that draws a grab handle.
//
// Every bottom sheet in this app has drawn a grabber since Phase 8, and exactly
// one of them (PlanComposer, patched after the PR #45 device test found it
// undismissable) ever responded to a drag. A handle that does not drag is a
// promise the interface breaks, so this lives in one place and every grabber
// sheet adopts it.
//
// NOT adopted by the action sheets (MooveActionsSheet, GoGreyConfirm): they
// carry an explicit Cancel row and no grab handle, and an invisible gesture on a
// control with no affordance is undiscoverable.

import { useCallback, useRef, useState } from 'react'

/** Past a third of the sheet's OWN height — proportional, so a short sheet and a
 *  tall composer do not demand the same travel. */
const DISMISS_FRACTION = 1 / 3
/** px per ms. A fast flick dismisses from anywhere past the floor below. */
const FLICK_VELOCITY = 0.5
/**
 * ...but a flick still has to TRAVEL. Without this floor, a quick thumb twitch
 * divides a few pixels by a few milliseconds, reads as enormous velocity, and
 * closes a sheet somebody was reading. Found in the mockup: a 40px twitch
 * dismissed it.
 */
const FLICK_MIN_DISTANCE = 60

interface SheetDrag {
  /** Spread onto the grab handle (or any element that should start a drag). */
  handleProps: {
    onPointerDown: (e: React.PointerEvent) => void
    style: { touchAction: 'none' }
  }
  /** Spread onto the sheet element itself. */
  sheetProps: {
    ref: (node: HTMLElement | null) => void
    style: React.CSSProperties
  }
  /** 1 → fully open, 0 → fully dragged away. Multiply the scrim's opacity by it
   *  so the gesture feels attached to something. */
  scrimOpacity: number
}

export function useSheetDrag(onClose: () => void): SheetDrag {
  const nodeRef = useRef<HTMLElement | null>(null)
  const startY = useRef(0)
  const startedAt = useRef(0)
  const dragging = useRef(false)
  const [offset, setOffset] = useState(0)
  const [settling, setSettling] = useState(false)

  const height = () => nodeRef.current?.offsetHeight ?? 0

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragging.current) return
    // Downward only. Dragging up must not stretch the sheet off its anchor.
    setOffset(Math.max(0, e.clientY - startY.current))
  }, [])

  const onPointerUp = useCallback(
    (e: PointerEvent) => {
      if (!dragging.current) return
      dragging.current = false
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)

      const dy = Math.max(0, e.clientY - startY.current)
      const elapsed = Math.max(1, Date.now() - startedAt.current)
      const velocity = dy / elapsed
      const far = dy > height() * DISMISS_FRACTION
      const flick = velocity > FLICK_VELOCITY && dy > FLICK_MIN_DISTANCE

      setSettling(true)
      if (far || flick) {
        // Slide it the rest of the way out, then hand back to the caller so the
        // sheet unmounts after the motion rather than snapping away mid-drag.
        setOffset(height())
        window.setTimeout(onClose, 180)
      } else {
        setOffset(0)
      }
    },
    [onPointerMove, onClose],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Ignore secondary buttons; let a right-click behave normally.
      if (e.button !== 0 && e.pointerType === 'mouse') return
      dragging.current = true
      startY.current = e.clientY
      startedAt.current = Date.now()
      setSettling(false)
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('pointercancel', onPointerUp)
    },
    [onPointerMove, onPointerUp],
  )

  const h = height()

  return {
    handleProps: { onPointerDown, style: { touchAction: 'none' } },
    sheetProps: {
      ref: (node: HTMLElement | null) => {
        nodeRef.current = node
      },
      style: {
        transform: offset ? `translateY(${offset}px)` : undefined,
        transition: settling ? 'transform .22s cubic-bezier(.22,.9,.3,1)' : undefined,
      },
    },
    scrimOpacity: h > 0 ? Math.max(0, 1 - offset / h) : 1,
  }
}
