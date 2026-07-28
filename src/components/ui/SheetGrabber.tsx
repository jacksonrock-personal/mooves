'use client'

// The grab handle every bottom sheet draws, with a target you can actually hit.
//
// R6 gave the grabber a real drag gesture and bound it to the pill: 9x4 CSS
// pixels. The gesture worked and was still unusable — on device you had to land
// on the very top edge of the sheet, repeatedly, to get out of one.
//
// The pill LOOKS the same. The touch target around it is 36px tall, achieved
// with padding and a matching negative margin so the layout footprint stays
// where it was and no caller has to re-tune its spacing.
//
// Overlap is deliberate and safe: the band bleeds 12px over whatever follows it,
// but it is the first child, so anything painted after it wins the hit test on
// the overlap. The band only collects taps that would otherwise have hit
// nothing.
//
// Tall sheets do not stop here — they also hand `headerProps` to their title
// block, which is what turns this from a 36px target into a ~130px one.

import type { useSheetDrag } from '@/lib/useSheetDrag'

interface SheetGrabberProps {
  drag: ReturnType<typeof useSheetDrag>
  /** The caller's own outer spacing (mb-4, mt-2.5 …), applied to the band. */
  className?: string
  /** Overrides the pill's look for the sheets whose grabber differs. */
  pillClassName?: string
  /**
   * Two sheets (WeekRitual, ConfirmFree) also made the grabber a close button.
   * Kept, because a control that both drags and taps is strictly more forgiving
   * than one that only drags.
   */
  onClose?: () => void
  label?: string
}

const DEFAULT_PILL = 'w-9 h-1 rounded-full bg-[#E8E4F5]'
/** py-4 -my-3 → 36px of target, 12px of layout. */
const BAND = 'shrink-0 flex justify-center items-center py-4 -my-3 cursor-grab'

export default function SheetGrabber({
  drag,
  className = '',
  pillClassName = DEFAULT_PILL,
  onClose,
  label,
}: SheetGrabberProps) {
  const pill = <span className={`block ${pillClassName}`} />

  if (onClose) {
    return (
      <button
        type="button"
        onClick={onClose}
        aria-label={label ?? 'Close'}
        className={`${BAND} w-full ${className}`}
        {...drag.handleProps}
      >
        {pill}
      </button>
    )
  }

  return (
    <div className={`${BAND} ${className}`} {...drag.handleProps}>
      {pill}
    </div>
  )
}
