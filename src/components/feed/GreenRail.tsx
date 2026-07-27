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
  selectedId: string | null
  onSelect: (id: string) => void
  /**
   * Tapping the avatar that is ALREADY selected texts them.
   *
   * Added after device testing: the rail reads as "the people who are free", so
   * tapping a face is expected to reach that person — the pre-Phase-20 muscle
   * memory, where a green card was a text handoff. First tap opens their card
   * (you need the note before you text), second tap sends you to Messages.
   * Never fires for your own avatar.
   */
  onText?: (id: string) => void
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

export default function GreenRail({ people, selectedId, onSelect, onText }: GreenRailProps) {
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
          const selected = p.id === selectedId
          return (
            <button
              key={p.id}
              onClick={() => {
                if (selected && !p.isMe && onText) onText(p.id)
                else onSelect(p.id)
              }}
              aria-pressed={selected}
              className="shrink-0 w-[58px] flex flex-col items-center gap-1"
            >
              <span className="relative">
                <Avatar src={p.avatarUrl} name={p.displayName} size={54} />
                <span
                  className={`absolute -inset-1 rounded-full pointer-events-none ${
                    later ? 'border-[2.5px] border-green-500/40' : 'border-[2.5px] border-green-500'
                  } ${selected ? 'border-[3px] ring-2 ring-green-500/20' : ''} ${
                    p.isMe ? 'border-dashed' : ''
                  }`}
                />
              </span>
              <span
                className={`max-w-[58px] truncate font-sans text-[11px] ${
                  selected ? 'font-bold text-ink-900' : 'font-semibold text-ink-500'
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
