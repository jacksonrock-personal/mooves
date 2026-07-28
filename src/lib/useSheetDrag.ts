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
//
// ── The target problem ──────────────────────────────────────────────────────
//
// R6 shipped with the drag bound to the grabber pill itself: 9x4 CSS pixels.
// On a real thumb that is a coin toss, and the device test said so — you had to
// hit the very top of the sheet, repeatedly, to get out of it.
//
// Three targets now, in descending order of how deliberate they are:
//
//   handleProps  — the grabber's padded row. Always drags.
//   headerProps  — the sheet's title block. Always drags. This is the one that
//                  turns a 4px target into ~130px, and it costs nothing: there
//                  is nothing else to do with a heading.
//   contentProps — the scrolling body. Drags ONLY from scrollTop 0 and ONLY
//                  downward, which is the standard sheet behaviour and the
//                  reason scrolling a long roster never yanks the sheet away.
//
// Against the opposite failure — a sheet that closes when you did not mean it,
// which is the more infuriating of the two — every path is behind ACTIVATION_PX
// of travel before it takes at all, and the pre-existing distance and flick
// floors are unchanged.

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
/**
 * Slop before a press becomes a drag. The sheet does not move at all until the
 * thumb has gone this far down, and the distance is then measured from here —
 * so the gesture starts where it engaged rather than jumping by 8px.
 *
 * This is what makes the much larger targets above safe. A tap on the header,
 * or a thumb resting on the list before flicking it upward, never budges the
 * sheet; only travel that is already unambiguously a downward drag does.
 */
const ACTIVATION_PX = 8

interface DragTargetProps {
  onPointerDown: (e: React.PointerEvent) => void
  style: { touchAction: 'none' | 'pan-y' }
}

interface SheetDrag {
  /** Spread onto the grab handle's row. */
  handleProps: DragTargetProps
  /** Spread onto the sheet's header/title block — the big, safe target. */
  headerProps: DragTargetProps
  /**
   * Spread onto the scrolling body. Engages only when that element is already
   * scrolled to the top, so it never competes with reading a long list.
   */
  contentProps: DragTargetProps
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
  /** A pointer is down on a drag target, but has not yet travelled far enough. */
  const armed = useRef(false)
  /** The drag has taken: the sheet is following the thumb. */
  const dragging = useRef(false)
  /** Set for a content drag, so we can bail if the list scrolls mid-press. */
  const scroller = useRef<HTMLElement | null>(null)
  const [offset, setOffset] = useState(0)
  const [settling, setSettling] = useState(false)

  const height = () => nodeRef.current?.offsetHeight ?? 0

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!armed.current) return
    const dy = e.clientY - startY.current

    if (!dragging.current) {
      // Still inside the slop. Downward only: an upward move on a list is a
      // scroll, and must not be sitting in a half-armed state afterwards.
      if (dy < ACTIVATION_PX) return
      // A content drag that started at the top but has since scrolled is a
      // scroll, not a drag. Give it up rather than fight it.
      if (scroller.current && scroller.current.scrollTop > 0) {
        armed.current = false
        return
      }
      dragging.current = true
    }

    setOffset(Math.max(0, dy - ACTIVATION_PX))
  }, [])

  const onPointerUp = useCallback(
    (e: PointerEvent) => {
      if (!armed.current) return
      const wasDragging = dragging.current
      armed.current = false
      dragging.current = false
      scroller.current = null
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)

      // Never travelled far enough to be a drag — it was a tap. Leave the sheet
      // exactly where it is and let the tap do whatever it was going to do.
      if (!wasDragging) return

      const dy = Math.max(0, e.clientY - startY.current - ACTIVATION_PX)
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

  const begin = useCallback(
    (e: React.PointerEvent, fromContent: boolean) => {
      // Ignore secondary buttons; let a right-click behave normally.
      if (e.button !== 0 && e.pointerType === 'mouse') return

      const el = e.currentTarget as HTMLElement
      // A content drag is only ever available from the very top of the scroll.
      if (fromContent) {
        if (el.scrollTop > 0) return
        scroller.current = el
      } else {
        scroller.current = null
      }

      armed.current = true
      dragging.current = false
      startY.current = e.clientY
      startedAt.current = Date.now()
      setSettling(false)
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('pointercancel', onPointerUp)
    },
    [onPointerMove, onPointerUp],
  )

  const onHandleDown = useCallback((e: React.PointerEvent) => begin(e, false), [begin])
  const onContentDown = useCallback((e: React.PointerEvent) => begin(e, true), [begin])

  const h = height()
  // The chrome may claim the vertical axis outright. The scrolling body may not:
  // `pan-y` keeps native scrolling, and the arming logic above is what decides
  // whether a given gesture ends up a scroll or a dismissal.
  const chrome: DragTargetProps = { onPointerDown: onHandleDown, style: { touchAction: 'none' } }

  return {
    handleProps: chrome,
    headerProps: chrome,
    contentProps: { onPointerDown: onContentDown, style: { touchAction: 'pan-y' } },
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
