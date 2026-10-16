'use client'

// R36 — the "Past" section at the foot of the feed.
//
// Collapsed by default to the section label and a chevron: no count, no
// thumbnails peeking out. It does not render at all until there is a past
// Moove (R31's no-empty-furniture rule) — the caller passes an empty list and
// gets nothing back.
//
// Past rows wear a GREY date tile, so they never read as something you can
// still join.

import { useState } from 'react'
import { posthog } from '@/lib/posthog'
import { pastTile, pastWhenLine, whoWasInLine, type PastMoove } from '@/lib/photos'
import AvatarStack from './AvatarStack'

interface PastSectionProps {
  moves: PastMoove[]
  meId: string
  onOpen: (move: PastMoove) => void
}

export default function PastSection({ moves, meId, onOpen }: PastSectionProps) {
  const [open, setOpen] = useState(false)
  if (moves.length === 0) return null

  return (
    <div className="mt-2">
      <button
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next) posthog.capture('past_section_opened', { count: moves.length })
        }}
        aria-expanded={open}
        className="w-full flex items-center gap-1.5 pt-4 pb-2.5 px-0.5 border-t border-[#E8E4F5]"
      >
        <span className="font-sans text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-500">
          Past
        </span>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-ink-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="rounded-2xl border-[1.5px] border-[#E8E4F5] bg-white overflow-hidden">
          {moves.map((m, i) => {
            const tile = pastTile(m.startAt)
            const others = m.people.filter(p => p.id !== meId)
            return (
              <button
                key={m.id}
                onClick={() => onOpen(m)}
                className={`w-full text-left px-3 py-[11px] ${i > 0 ? 'border-t border-grey-100' : ''}`}
              >
                <div className="flex items-center gap-[11px]">
                  <div className="w-[46px] h-[46px] shrink-0 rounded-[13px] bg-grey-100 flex flex-col items-center justify-center gap-0.5 px-0.5">
                    <span className="font-display font-extrabold text-[13px] leading-none tracking-tight text-ink-500">
                      {tile.top}
                    </span>
                    <span className="font-sans text-[8.5px] font-bold tracking-[0.04em] leading-none text-ink-500/80 text-center">
                      {tile.bottom}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold text-[15px] leading-tight tracking-tight text-ink-900 truncate">
                      {m.title}
                    </p>
                    <p className="font-sans text-[12.5px] leading-snug text-ink-500 mt-0.5 truncate">
                      {pastWhenLine(m.startAt, m.locationText)}
                    </p>
                  </div>
                </div>
                {(others.length > 0 || m.thumbs.length > 0) && (
                  <div className="flex items-center mt-[9px]">
                    <AvatarStack people={others} size={20} max={3} overlapClassName="-ml-[7px]" />
                    <span className="font-sans text-[11.5px] font-semibold text-ink-500 ml-2 min-w-0 truncate">
                      {whoWasInLine(m.people, meId)}
                    </span>
                    {m.thumbs.length > 0 && (
                      <span className="ml-auto shrink-0 flex gap-[3px] pl-2">
                        {m.thumbs.map(src => (
                          <img
                            key={src}
                            src={src}
                            alt=""
                            className="block w-[30px] h-[30px] rounded-[7px] object-cover bg-grey-100"
                          />
                        ))}
                      </span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
