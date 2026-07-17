'use client'

// Phase 10.1 — grey-feed ambient tier: shown when the viewer has friends but
// none are green right now. One aggregate, never-named signal at a time, each
// suppressed below 3 (prefer the more immediate "around now"); otherwise a warm,
// no-number fallback. The pulse is GREY — it signals activity, not availability.

interface AmbientTierProps {
  activeNow: number
  recentGreen: number
}

export default function AmbientTier({ activeNow, recentGreen }: AmbientTierProps) {
  const signal =
    activeNow >= 3
      ? { count: activeNow, label: 'around now', live: true }
      : recentGreen >= 3
        ? { count: recentGreen, label: 'were green this week', live: false }
        : null

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 pb-8">
      <div className="relative w-[108px] h-[108px] flex items-center justify-center mb-6">
        <span className="absolute top-1/2 left-1/2 w-[108px] h-[108px] rounded-full border-2 border-grey-300/60 animate-ambient-pulse" />
        <span className="absolute top-1/2 left-1/2 w-[108px] h-[108px] rounded-full border-2 border-grey-300/60 animate-ambient-pulse [animation-delay:1.3s]" />
        <span className="relative w-11 h-11 rounded-full bg-grey-300/25 flex items-center justify-center">
          <span className="w-4 h-4 rounded-full bg-grey-300" />
        </span>
      </div>

      {signal ? (
        <>
          <p className="flex items-center gap-2 font-sans text-[15px] text-ink-900 mb-2">
            <span className={`w-[7px] h-[7px] rounded-full bg-grey-300 ${signal.live ? 'shadow-[0_0_0_4px_rgba(189,181,212,0.35)]' : ''}`} />
            <span><b className="font-bold">{signal.count} friends</b> {signal.label}</span>
          </p>
          <p className="font-sans text-[14px] text-ink-500">Go free to get in on the action.</p>
        </>
      ) : (
        <>
          <p className="font-display font-extrabold text-[19px] text-ink-900 tracking-tight mb-2">
            People want to hang out.
          </p>
          <p className="font-sans text-[14px] text-ink-500 leading-relaxed">
            Be the first to go free and get in on the action.
          </p>
        </>
      )}
    </div>
  )
}
