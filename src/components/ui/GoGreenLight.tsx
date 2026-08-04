// R24 — the go-green tile's icon: a traffic light on a light-purple disc.
//
// It replaces your own greyscale photo plus a purple `+` at the head of the
// rail. Two things were wrong with that tile. Your own face is the least useful
// photo on the screen and it was spending the rail's most valuable slot saying
// nothing; and a purple `+` badge on a circular photo is, everywhere else on a
// phone, "add a story" — the exact wrong promise for the app's most important
// action.
//
// WHY NOTHING IN HERE IS DIMMED. Going green SWAPS this tile for your actual
// face (R24, and see Rail.tsx), so the light only ever has to depict one state
// and every lamp stays lit. That is what makes it legible at 54px: a signal box
// with two dark lamps just reads as a dark blob at this size. Your availability
// is carried where it is carried for everyone else on the rail — the ring —
// which is also why this component draws no ring of its own.
//
// The disc keeps the rail's circular rhythm; the box inside is what makes it
// read as a traffic light rather than as three loose dots.
//
// Mockup: mooves-phase25-rail-tile-experiment.html.

interface GoGreenLightProps {
  /** Diameter of the disc. 54 in the rail, 42 in onboarding card 1. */
  size?: number
  className?: string
}

// Everything scales off the disc so the two sizes cannot drift apart. Derived
// from the mockup's 54px tile: a 22×41 box with 10.5px lamps.
const BOX_W = 22 / 54
const BOX_H = 41 / 54
const LAMP = 10.5 / 54
const GAP = 3.5 / 54
const RADIUS = 7 / 54

/**
 * Red and amber are ICON colours, not status tokens, so they are literal here
 * rather than design-system entries. The green is deliberately NOT: it is
 * green-500, the same green as the rings two tiles away, because a louder one
 * would read as a different kind of green.
 */
const LAMPS = [
  { fill: '#FF3B30', glow: 'rgba(255,59,48,0.85)' },
  { fill: '#FFB300', glow: 'rgba(255,179,0,0.85)' },
  { fill: '#2ECC71', glow: 'rgba(46,204,113,0.95)' },
]

export default function GoGreenLight({ size = 54, className = '' }: GoGreenLightProps) {
  const lamp = size * LAMP
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-purple-100 ${className}`}
      style={{ width: size, height: size }}
    >
      <span
        className="flex flex-col items-center justify-center bg-ink-900"
        style={{
          width: size * BOX_W,
          height: size * BOX_H,
          borderRadius: size * RADIUS,
          gap: size * GAP,
          // A hairline of light along the top edge, so the box reads as an
          // object with a surface rather than as a hole punched in the disc.
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)',
        }}
      >
        {LAMPS.map(l => (
          <span
            key={l.fill}
            className="block rounded-full"
            style={{
              width: lamp,
              height: lamp,
              background: l.fill,
              boxShadow: `0 0 ${lamp * 0.55}px ${l.glow}`,
            }}
          />
        ))}
      </span>
    </span>
  )
}
