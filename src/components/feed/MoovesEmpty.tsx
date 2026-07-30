'use client'

// The Mooves list, empty.
//
// §20.4 gave the feed exactly one empty state — `AmbientTier`, shown when the
// rail AND the Mooves list are both empty. That left the most common state of
// all undesigned: friends ARE green, so the rail is full and AmbientTier is
// correctly suppressed, but nobody has planned anything, so everything below
// the swipe is white space. The feed didn't read as "no Mooves yet", it read
// as a screen that failed to load.
//
// Deliberately quieter than AmbientTier. AmbientTier is a hero state for a
// feed with no signal in it at all; this one sits UNDER a rail of live faces,
// so it only has to name the surface and offer the action.
//
// The dashed tile is the same 46px purple square a real Moove card leads with,
// so the empty state is shaped like the thing it is missing.

interface MoovesEmptyProps {
  onPlan: () => void
}

export default function MoovesEmpty({ onPlan }: MoovesEmptyProps) {
  return (
    <div className="rounded-2xl border-[1.5px] border-dashed border-[#DED7F2] bg-purple-50/60 px-4 py-6 flex flex-col items-center text-center">
      <div className="w-[46px] h-[46px] rounded-[13px] border-[1.5px] border-dashed border-purple-500/40 bg-purple-100/60 flex items-center justify-center mb-3.5">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="text-purple-500">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </div>

      <p className="font-display font-extrabold text-[16px] text-ink-900 tracking-tight mb-1">
        Nothing planned yet.
      </p>
      <p className="font-sans text-[13px] text-ink-500 leading-snug mb-4 max-w-[240px]">
        Friends are free up there. Give them something to join.
      </p>

      <button
        onClick={onPlan}
        className="px-5 py-2.5 rounded-full bg-purple-500 text-white font-sans font-bold text-[13.5px]"
      >
        Plan a Moove
      </button>
    </div>
  )
}
