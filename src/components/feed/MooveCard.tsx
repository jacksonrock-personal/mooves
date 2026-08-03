'use client'

// Phase 24.7 — the Community / Sponsored Moove card.
//
// Replaces SponsoredCard, whose shape was the problem: "I'm interested" gated
// the action that actually mattered ("Go with friends") behind a tap that did
// nothing for the user. It was telemetry wearing a button costume, and every
// person who declined it never learned they could bring anyone.
//
// So: ONE button, always. "Make it a Moove" is live from the first render, and
// "I'd go" became a real social signal instead of a toll gate.
//
// THE RULE THAT MATTERS MOST HERE — declared and computed must never look alike:
//
//   declared  solid avatars, green ring, ink text     "Maya and Dev are in"
//   computed  dashed ring, greyscale, dimmed text     "Sam would probably go"
//
// If a reader cannot tell at a glance which is a promise and which is a guess,
// the guess has borrowed the credibility of the promise and the declared signal
// is worth less than it was. That is the failure mode to watch in review.
//
// Mockup: mooves-concept-mooves-in-feed.html (toggle 4 stacks all four variants).

import type { SocialLine } from '@/lib/nearMatch'
import type { NearMove } from '@/app/api/discover/route'

interface MooveCardProps {
  move: NearMove
  /** Opens the planned-Moove composer, prefilled and carrying the anchor. */
  onMakeMoove: (move: NearMove) => void
}

function initial(name: string | null) {
  return name?.trim()?.[0]?.toUpperCase() ?? '?'
}

/** Avatar stack. `guess` is what makes a computed line unmistakably a guess. */
function Stack({ people, guess }: { people: { id: string; displayName: string | null; avatarUrl: string | null }[]; guess?: boolean }) {
  return (
    <span className="flex">
      {people.slice(0, 3).map((p, i) => (
        <span
          key={p.id}
          className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[9px] font-display font-extrabold text-white bg-purple-500 ${
            i > 0 ? '-ml-[7px]' : ''
          } ${
            guess
              ? 'border-[2px] border-dashed border-grey-300 opacity-50 grayscale'
              : 'border-[2px] border-white ring-[1.5px] ring-green-500'
          }`}
        >
          {p.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            initial(p.displayName)
          )}
        </span>
      ))}
    </span>
  )
}

function names(people: { displayName: string | null }[]) {
  const list = people.map(p => p.displayName?.trim() || 'Someone')
  if (list.length === 1) return list[0]
  if (list.length === 2) return `${list[0]} and ${list[1]}`
  return `${list[0]}, ${list[1]} and ${list.length - 2} more`
}

function Social({ social }: { social: SocialLine }) {
  // Group fit gets a band rather than a line: it is the only computed signal
  // resting entirely on greens those people declared themselves.
  if (social.kind === 'groupFit') {
    return (
      <div className="flex items-center gap-2 mt-[11px] bg-green-100 rounded-xl px-[11px] py-[9px]">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#167A43" strokeWidth="2" strokeLinecap="round" className="shrink-0">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        </svg>
        <span className="font-sans text-[12px] font-semibold text-green-700 leading-tight">
          {social.count} of <b className="font-extrabold">{social.groupName}</b> are free for this
        </span>
      </div>
    )
  }

  const guess = social.kind === 'computed'
  return (
    <div className="flex items-center gap-2 mt-[11px] pt-[11px] border-t border-grey-100">
      <Stack people={social.friends} guess={guess} />
      <span className={`font-sans text-[12px] leading-tight ${guess ? 'text-grey-300' : 'text-ink-500'}`}>
        {guess ? (
          <>
            <b className="font-semibold text-ink-500">{names(social.friends)}</b> would probably go
          </>
        ) : (
          <>
            <b className="font-bold text-ink-900">{names(social.friends)}</b>{' '}
            {social.friends.length === 1 ? 'is' : 'are'} in
          </>
        )}
      </span>
    </div>
  )
}

export default function MooveCard({ move, onMakeMoove }: MooveCardProps) {
  const paid = move.origin === 'sponsor'

  const facts = [
    move.timeText,
    move.neighborhood,
  ].filter(Boolean) as string[]

  return (
    <div className="bg-white border-[1.5px] border-[#E8E4F5] rounded-[18px] overflow-hidden mb-2.5">
      {/* The label sits on the image, same shape for both kinds. Community and
          Sponsored differ only in colour, so the distinction is read rather than
          felt as an interruption — and a shelf that is mostly community events
          never reads as an ad break. */}
      <div className="relative h-[104px] flex items-end p-[9px] bg-gradient-to-br from-purple-100 to-[#DCD3F7]">
        {move.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={move.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <span
          className={`relative inline-flex items-center gap-1 rounded-full px-2 py-[3px] bg-white/90 backdrop-blur-sm font-sans text-[9.5px] font-bold uppercase tracking-[0.06em] ${
            paid ? 'text-purple-700' : 'text-ink-500'
          }`}
        >
          <span className={`w-[5px] h-[5px] rounded-full ${paid ? 'bg-purple-500' : 'bg-grey-300'}`} />
          {paid ? `Sponsored${move.brand ? ` · ${move.brand}` : ''}` : 'Community Moove'}
        </span>
      </div>

      <div className="px-3.5 pt-[13px] pb-3.5">
        <h4 className="font-display font-extrabold text-[16px] text-ink-900 tracking-[-0.01em] leading-[1.2]">
          {move.title}
        </h4>

        <div className="flex items-center gap-[7px] flex-wrap mt-1.5 font-sans text-[12.5px] text-ink-500">
          {facts.map((f, i) => (
            <span key={f} className="flex items-center gap-[7px]">
              {i > 0 && <span className="w-[3px] h-[3px] rounded-full bg-grey-300" />}
              {f}
            </span>
          ))}
          {move.priceText && (
            <span className="flex items-center gap-[7px]">
              {facts.length > 0 && <span className="w-[3px] h-[3px] rounded-full bg-grey-300" />}
              <span className="font-bold text-ink-900">{move.priceText}</span>
            </span>
          )}
        </div>

        {move.description && (
          <p className="font-sans text-[12.5px] text-ink-500 leading-[1.45] mt-2">{move.description}</p>
        )}

        {move.social && <Social social={move.social} />}

        {/* ONE button, and it is the real action. The computed line above
            carries none of its own: this is what does the asking, opening the
            composer with the named people already picked.

            "I'd go" deliberately does NOT live here. It belongs in the detail
            sheet alongside the full description and the source link (24.7:
            "one CTA per card, always — no secondary buttons in any variant").
            The sheet lands in 2b; until then declared lines render from
            existing move_interested rows but nothing new can be declared. */}
        <button
          onClick={() => onMakeMoove(move)}
          className="w-full mt-3 py-3 rounded-[14px] bg-purple-500 text-white font-display font-extrabold text-[14.5px] tracking-[-0.01em]"
        >
          Make it a Moove
        </button>
      </div>
    </div>
  )
}
