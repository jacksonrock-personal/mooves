'use client'

// R21/R22 — the rail. Everyone is in it, always.
//
// It used to hold only greens and disappear when nobody was free, which meant
// the app's most common state rendered a feed with no people in it at all. And
// it shared the top of the screen with the slide bar: one control for who is
// free, one for you. Now there is one surface, and going green is your own tile.
//
// R24 amends the first tile only: grey, it is a traffic light labelled "Go
// green"; green, it is your face, exactly like everyone else's. One slot, and
// its state is the control or the person, never both. The label is "Go green"
// across the whole app now — "Go free" named the same action a second way, and
// two names for one action is what made the old tile ambiguous.
//
// Green is THE RING and nothing else. Everyone not free is greyscale, ringless
// and unlabelled.
//
// R25 — EVERY tile is a button now, including the grey ones. The old rule was
// that a grey tile is deliberately not a button, because "green is what makes
// someone contactable and a rail where every face opened Messages would make
// going green decorative". That rule survives intact — it is about MESSAGING,
// and messaging is still gated on green. What a tile opens now is a WEEK, which
// is a thing a grey face genuinely has to say. Texting lives one level in, as
// the sheet's only CTA, so a green friend costs one extra tap and nothing else
// changed hands.
//
// A friend who is green but scoped away from you arrives here as an ordinary
// grey, because get_feed never returned them. The rule that the rail cannot
// leak a green you were not included in is therefore structural, not a filter
// somebody has to remember to apply — and get_friend_week carries the same
// rule for the week behind the tile, for the same reason.

import Avatar from '@/components/ui/Avatar'
import GoGreenLight from '@/components/ui/GoGreenLight'
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
  /**
   * R25 — one tap on ANY friend, green or grey, opens their week. Messages
   * moved inside that sheet. Replaces onText, which only ever fired on greens.
   */
  onOpenFriend: (id: string) => void
}

export default function Rail({ people, seed, onOpenMine, onOpenFriend }: RailProps) {
  return (
    // The "FREE" eyebrow that used to sit above this is gone: the rail holds
    // everyone now, so the label described a row that is mostly not free.
    //
    // R21b — 14px, up from 11px. Each ring sits 4px outside a 54px avatar in a
    // 58px tile, so it overhangs the tile by 2px per side: at 11px that left
    // only 7px of clear page between two rings, which was fine while only
    // greens were ringed and reads as one continuous strip once every tile is.
    // 14px leaves 10px, measured.
    //
    // The scroll box is FULL-BLEED (-mx-4 cancels the feed's px-4) and puts the
    // inset back as its own padding, because `overflow-x: auto` computes
    // overflow-y to `auto` as well — so the box clips on every side, not just
    // horizontally. Each ring sits 4px outside its tile, and with the inset as
    // margin those 4px fell outside the scroll box: the first and last rings
    // were sliced flat by the page gutter and every ring lost its top to a 2px
    // pt-0.5. As padding, the same 16px is inside the box and the overhang has
    // somewhere to go. pt-1.5 is 6px against a 4px overhang, for the same
    // reason on the other axis.
    <div className="-mx-4 px-4 flex gap-[14px] overflow-x-auto pt-1.5 pb-1 mb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {sortRail(people, seed).map(p => {
        const later = p.isGreen && bucketOf(p.statusTime) !== 'now'
        const name = p.isMe ? (p.isGreen ? 'You' : 'Go green') : (p.displayName ?? 'Friend')

        // R24 — your grey tile is a traffic light, not your photo. Going green
        // SWAPS it for your face, so the two states are the control and then
        // the person, and the slot never holds both at once. That swap is what
        // lets the light stay fully lit (see GoGreenLight): it never has to
        // also mean "off". Everyone else's tile is untouched in both states.
        const isLight = p.isMe && !p.isGreen

        const inner = (
          <>
            <span className="relative">
              {isLight ? (
                <GoGreenLight size={54} />
              ) : (
                <Avatar
                  src={p.avatarUrl}
                  name={p.displayName}
                  size={54}
                  className={p.isGreen ? '' : 'grayscale opacity-[0.48]'}
                />
              )}
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
              {/* R22's purple `+` badge is GONE, with the photo it sat on. It
                  existed to say "this tile is a control", which the light now
                  says by being one, and a `+` on a photo reads as "add a story"
                  everywhere else on a phone. Its z-[1] paint-order note (R21b)
                  retires with it. */}
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

        // R25 — the grey-tile-is-not-a-button branch is gone. Nothing about
        // the tile's APPEARANCE changed with it: no badge, no affordance, no
        // hint. A grey face looks exactly as it did, and the week behind it is
        // found by tapping or not at all. That was Jackson's call at mockup —
        // the discovery job belongs to the Friends row's count chip.
        return (
          <button
            key={p.id}
            onClick={() => (p.isMe ? onOpenMine() : onOpenFriend(p.id))}
            aria-label={
              p.isMe
                ? p.isGreen
                  ? 'Your green'
                  : 'Go green'
                : `${p.displayName ?? 'Friend'}'s week`
            }
            className={tileClass}
          >
            {inner}
          </button>
        )
      })}
    </div>
  )
}
