// R38 — the nav's "Plan a Moove" disc, scaled down for onboarding's
// "Tap the cow to plan a Moove." line.
//
// Every dimension is derived from BottomNav's real disc (70px disc, 5.5px white
// border, 46px cow, 28px plus badge) so the thing onboarding points at is the
// thing the user will find in the bar, badge and all. Static, not a button.

import CowMark from '@/components/ui/CowMark'

const NAV_DISC = 70

export default function CowDisc({ size }: { size: number }) {
  const k = size / NAV_DISC
  const badge = 28 * k
  return (
    <span
      aria-hidden
      className="relative flex shrink-0 items-center justify-center rounded-full border-solid border-white bg-mooves-purple"
      style={{
        width: size,
        height: size,
        borderWidth: Math.max(2.5, 5.5 * k),
        boxShadow: `0 ${8 * k}px ${22 * k}px rgba(124,92,219,0.42)`,
      }}
    >
      <CowMark size={Math.round(46 * k)} />
      <span
        className="absolute flex items-center justify-center rounded-full border-solid border-white bg-white"
        style={{
          width: badge,
          height: badge,
          right: -4 * k,
          bottom: -4 * k,
          borderWidth: Math.max(1.5, 3.5 * k),
        }}
      >
        <svg width={15 * k} height={15 * k} viewBox="0 0 24 24" fill="none" stroke="#7C5CDB" strokeWidth="3.6" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>
    </span>
  )
}
