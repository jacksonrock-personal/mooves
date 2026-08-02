'use client'

// R21/R22 — the rail. Everyone is in it, always.
//
// It used to hold only greens and disappear when nobody was free, which meant
// the app's most common state rendered a feed with no people in it at all. And
// it shared the top of the screen with the slide bar: one control for who is
// free, one for you. Now there is one surface, and going free is your own tile.
//
// Green is THE RING and nothing else. Everyone not free is greyscale, ringless,
// unlabelled, and — deliberately — not a button:
//
//   Green is what makes someone contactable. A rail where every face opened
//   Messages would make going green decorative.
//
// A friend who is green but scoped away from you arrives here as an ordinary
// grey, because get_feed never returned them. The rule that the rail cannot
// leak a green you were not included in is therefore structural, not a filter
// somebody has to remember to apply.

import Avatar from '@/components/ui/Avatar'
import { bucketOf, LABEL, sortRail, type RailPerson } from '@/lib/rail'

interface RailProps {
  people: RailPerson[]
  /** Fixed for the life of the screen, so the grey tail never moves under the thumb. */
  seed: number
  /**
   * Your own tile. Grey, it opens the Go Green sheet; green, it opens "Your
   * green" (R17). The caller owns that branch because it owns the state that
   * produced the tile.
   */
  onOpenMine: () => void
  /** ONE tap on a free friend opens Messages. Greens carry nothing left to read. */
  onText: (id: string) => void
}

export default function Rail({ people, seed, onOpenMine, onText }: RailProps) {
  return (
    // The "FREE" eyebrow that used to sit above this is gone: the rail holds
    // everyone now, so the label described a row that is mostly not free.
    //
    // R21b — 14px, up from 11px. Each ring sits 4px outside a 54px avatar in a
    // 58px tile, so it overhangs the tile by 2px per side: at 11px that left
    // only 7px of clear page between two rings, which was fine while only
    // greens were ringed and reads as one continuous strip once every tile is.
    // 14px leaves 10px, measured.
    <div className="flex gap-[14px] overflow-x-auto pt-0.5 pb-1 mb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {sortRail(people, seed).map(p => {
        const later = p.isGreen && bucketOf(p.statusTime) !== 'now'
        const name = p.isMe ? (p.isGreen ? 'You' : 'Go free') : (p.displayName ?? 'Friend')

        const inner = (
          <>
            <span className="relative">
              <Avatar
                src={p.avatarUrl}
                name={p.displayName}
                size={54}
                className={p.isGreen ? '' : 'grayscale opacity-[0.48]'}
              />
              {/* R21b — EVERY tile carries a ring, at the same inset. Only its
                  weight and colour say whether the person is free, so going
                  green is a change in the ring rather than a ring appearing out
                  of nowhere. Bare circular photos against the page read as cut
                  out and sharp; the halo is what softens them. Grey is half the
                  green's weight so the two can never be confused. */}
              <span
                className={`absolute -inset-1 rounded-full pointer-events-none ${
                  p.isGreen
                    ? `border-[2.5px] ${later ? 'border-green-500/40' : 'border-green-500'} ${
                        p.isMe ? 'border-dashed' : ''
                      }`
                    : 'border-[1.25px] border-grey-300'
                }`}
              />
              {/* R22 — the + is yours alone, and only while you are grey. On a
                  green ring it would put an action colour where availability
                  lives. */}
              {p.isMe && !p.isGreen ? (
                // The badge overlaps the ring, and its purple-50 border punches
                // the ring out where they cross. That only works while the
                // badge paints LAST: here it does, by DOM order, but in the
                // mockup the ring was an ::after — which paints after every
                // child — and drew a grey hairline straight across the badge.
                // z-[1] pins the outcome so reordering these siblings cannot
                // quietly bring that back.
                <span className="absolute -right-[3px] -bottom-[3px] z-[1] w-[22px] h-[22px] rounded-full bg-purple-500 border-[2.5px] border-purple-50 flex items-center justify-center shadow-[0_2px_6px_rgba(124,92,219,0.42)]">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.6" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              ) : null}
            </span>

            <span
              className={`max-w-[58px] truncate font-sans text-[11px] ${
                p.isMe ? 'font-bold text-ink-900' : 'font-semibold text-ink-500'
              }`}
            >
              {name}
            </span>

            {/* The label slot always holds its height, so the rail does not
                change height as people go green and grey.
                It is a FIXED line box, not a min-height: measured, the
                inherited line-height is 14.25px, so a filled label was 14.25px
                against an empty one's 13px, and the whole rail lost 1.25px the
                moment the last green went grey. */}
            <span
              className={`h-[13px] leading-[13px] font-sans text-[9.5px] font-bold uppercase tracking-[0.04em] ${
                later ? 'text-ink-500' : 'text-green-700'
              }`}
            >
              {p.isGreen ? LABEL[bucketOf(p.statusTime)] : ''}
            </span>
          </>
        )

        const tileClass = 'shrink-0 w-[58px] flex flex-col items-center gap-1'

        // Not a disabled button — not a button at all. A disabled button is
        // still an element carrying a pressed-looking affordance and a story
        // about why it will not work; a friend who is not free has no story.
        if (!p.isMe && !p.isGreen) {
          return (
            <span key={p.id} className={tileClass}>
              {inner}
            </span>
          )
        }

        return (
          <button
            key={p.id}
            onClick={() => (p.isMe ? onOpenMine() : onText(p.id))}
            aria-label={p.isMe ? (p.isGreen ? 'Your green' : 'Go free') : `Text ${p.displayName ?? 'friend'}`}
            className={tileClass}
          >
            {inner}
          </button>
        )
      })}
    </div>
  )
}
