'use client'

import { type ReactNode } from 'react'
import { useSheetDrag } from '@/lib/useSheetDrag'
import SheetGrabber from './SheetGrabber'

interface SheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  // Lifts the sheet up by this many pixels from the bottom. Used to keep the
  // sheet (and its CTA) above the on-screen keyboard — callers measure the
  // keyboard via the VisualViewport API and pass its height. Defaults to 0
  // (flush to the bottom) so every existing caller is unaffected.
  bottomInset?: number
}

export default function Sheet({ open, onClose, children, className = '', bottomInset = 0 }: SheetProps) {
  // R6 — the handle below has been drawn since Phase 8 and never dragged. Every
  // caller of this component inherits the gesture from here.
  const drag = useSheetDrag(onClose)

  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        style={{ opacity: drag.scrimOpacity }}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sheet — the outer element carries the safe-area inset (base 0), the inner
          wrapper carries the caller's own padding, so the two compose (inset is added
          below the caller's bottom padding) without any caller needing to change. */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl safe-area-pb"
        style={{
          ...(bottomInset > 0 ? { bottom: bottomInset } : {}),
          ...drag.sheetProps.style,
        }}
        ref={drag.sheetProps.ref as (node: HTMLDivElement | null) => void}
        role="dialog"
        aria-modal="true"
      >
        <div className={className}>
          <SheetGrabber drag={drag} className="mt-5 mb-3" pillClassName="w-9 h-1 rounded-full bg-gray-200" />
          {children}
        </div>
      </div>
    </>
  )
}
