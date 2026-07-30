'use client'

// R16/R17 — sliding panes inside ONE sheet.
//
// The friend picker was first built as its own bottom sheet, opening on top of
// the sheet that summoned it. On the green modal that meant three sheets
// stacked, each with its own scrim and its own grab handle, and it read as
// exactly what it was: a pile.
//
// A sheet is a PLACE. Sliding sideways inside it says "still the same place,
// further in", which is what opening a picker actually means. It needs no
// second scrim, no second grabber, and no second height.
//
// ── Why this is legal under R9 ──────────────────────────────────────────────
//
// R9 exists because a sheet that resizes under your thumb is what made the
// composer feel broken. So every pane is `flex: 0 0 100%` of a track that fills
// a FIXED-height sheet, and only the track's transform changes. A pane can be
// short or long and the frame does not move a pixel. Panes that are not current
// are also made inert, so a hidden pane's inputs stay out of the tab order.
//
// The drag-to-dismiss hook stays bound to the SHEET, never to a pane. Dragging
// down always means "leave", at any depth — sideways is the only axis this
// component owns.

interface PaneTrackProps {
  /** Zero-based index of the visible pane. */
  pane: number
  children: React.ReactNode
}

export default function PaneTrack({ pane, children }: PaneTrackProps) {
  const panes = Array.isArray(children) ? children : [children]

  return (
    // The track's width must be DEFINITE, which is why the clipper is a block
    // and not a flex row. As a flex row it made the track a flex item sized
    // `flex: 1 1 0%`, and a percentage flex-basis inside an indefinite main
    // size is resolved differently by every engine: Chrome gave the track the
    // container's width, WEBKIT SIZED IT TO ITS CONTENT — three panes' worth —
    // so every pane was ~1.8x the screen and the whole sheet rendered cut off
    // on iPhones. Measured in WebKit at 393px: track 713px before, 393px after.
    // Widths here now resolve against a block ancestor, so no engine has to
    // guess.
    <div className="flex-1 min-h-0 overflow-hidden">
      <div
        className="h-full w-full flex transition-transform duration-[320ms] ease-[cubic-bezier(.22,.9,.3,1)]"
        style={{ transform: `translateX(-${pane * 100}%)` }}
      >
        {panes.map((child, i) => (
          <div
            key={i}
            aria-hidden={i !== pane}
            className={`shrink-0 grow-0 basis-full w-full min-w-0 min-h-0 flex flex-col ${
              i === pane ? '' : 'invisible pointer-events-none'
            }`}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  )
}

/** The back chevron every pane past the first one carries. */
export function PaneBack({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="shrink-0 -ml-2 w-9 h-9 rounded-full flex items-center justify-center text-ink-500 active:bg-purple-50"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 5 8 12 15 19" />
        </svg>
      </button>
      <h2 className="font-display font-extrabold text-[18px] text-ink-900 tracking-tight">{label}</h2>
    </div>
  )
}
