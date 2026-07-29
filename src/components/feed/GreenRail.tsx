'use client'

// Phase 20.2 — the rail. Every green lives here; the feed below is Mooves only.
//
// Rail is people, feed is what's happening. Interleaving the two was tried and
// rejected at mockup ("like a striped animal") — one surface per object means
// the striping cannot come back structurally, not just by convention.
//
// Ordered by immediacy, each avatar labelled with its own window, and non-`now`
// greens get a softer ring so "right now" still reads first at a glance.

import Avatar from '@/components/ui/Avatar'

export interface RailPerson {
  id: string
  displayName: string | null
  avatarUrl: string | null
  statusTime: string | null
  isMe?: boolean
}

interface GreenRailProps {
  people: RailPerson[]
  /**
   * ONE tap on a friend's face opens Messages.
   *
   * The two-tap version existed so you could read their vibe note first. Greens
   * no longer carry a note — the go-green sheet is visibility, when, and free-
   * until — so there was nothing left to read and the intermediate card was
   * just a tax on the core loop.
   */
  onText?: (id: string) => void
  /**
   * R17 — your own face opens "Your green" instead, because you cannot text
   * yourself and that sheet is where Free until, visibility and go-grey live.
   *
   * The rail no longer has a SELECTION at all. `selectedId`/`onSelect` existed
   * to say which green's card was expanded underneath, and there are no green
   * cards left on the feed.
   */
  onOpenMine?: () => void
}

const ORDER: Record<string, number> = { now: 0, tonight: 1, week: 2, weekend: 3 }

/** A green with no chip counts as `now` — the same rule wave_group_for_viewer uses. */
function bucketOf(statusTime: string | null): string {
  return statusTime && statusTime in ORDER ? statusTime : 'now'
}

const LABEL: Record<string, string> = {
  now: 'Now',
  tonight: 'Tonight',
  week: 'This wk',
  weekend: 'Wknd',
}

export function sortRail(people: RailPerson[]): RailPerson[] {
  return [...people].sort((a, b) => {
    // You always lead, "Your story"-style.
    if (a.isMe !== b.isMe) return a.isMe ? -1 : 1
    return ORDER[bucketOf(a.statusTime)] - ORDER[bucketOf(b.statusTime)]
  })
}

export default function GreenRail({ people, onText, onOpenMine }: GreenRailProps) {
  if (people.length === 0) return null

  return (
    <div className="mb-3">
      <p className="font-sans text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-500 px-0.5 pb-2">
        Free
      </p>
      <div className="flex gap-[11px] overflow-x-auto pt-0.5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sortRail(people).map(p => {
          const bucket = bucketOf(p.statusTime)
          const later = bucket !== 'now'
          return (
            <button
              key={p.id}
              onClick={() => {
                if (p.isMe) onOpenMine?.()
                else onText?.(p.id)
              }}
              aria-label={p.isMe ? 'Your green' : `Text ${p.displayName ?? 'friend'}`}
              className="shrink-0 w-[58px] flex flex-col items-center gap-1"
            >
              <span className="relative">
                <Avatar src={p.avatarUrl} name={p.displayName} size={54} />
                <span
                  className={`absolute -inset-1 rounded-full pointer-events-none ${
                    later ? 'border-[2.5px] border-green-500/40' : 'border-[2.5px] border-green-500'
                  } ${p.isMe ? 'border-dashed' : ''}`}
                />
              </span>
              <span
                className={`max-w-[58px] truncate font-sans text-[11px] ${
                  p.isMe ? 'font-bold text-ink-900' : 'font-semibold text-ink-500'
                }`}
              >
                {p.isMe ? 'You' : (p.displayName ?? 'Friend')}
              </span>
              <span
                className={`font-sans text-[9.5px] font-bold uppercase tracking-[0.04em] ${
                  later ? 'text-ink-500' : 'text-green-700'
                }`}
              >
                {LABEL[bucket]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
