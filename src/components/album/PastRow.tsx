'use client'

// R39 — one past Moove, as a row. Shared by the feed's preview and the Past
// Mooves page, so the two never drift apart.
//
// Photos lead: a row with an album shows a strip of up to four at real size,
// "+N" on the last when there are more. A row without photos shows a quiet
// "Add photos" while the 30-day window is open, and nothing after.
//
// The date tile is GREY, so a past row never reads as something you can still
// join.

import { albumIsOpen, pastTile, pastWhenLine, whoWasInLine, type PastMoove } from '@/lib/photos'
import AvatarStack from './AvatarStack'

interface PastRowProps {
  move: PastMoove
  meId: string
  /** Search text to tint in the title and place. */
  highlight?: string
  onOpen: (move: PastMoove) => void
}

/** Wraps the first case-insensitive match of `q` in a tinted <mark>. */
function Highlighted({ text, q }: { text: string; q?: string }) {
  const needle = q?.trim().toLowerCase()
  const at = needle ? text.toLowerCase().indexOf(needle) : -1
  if (!needle || at < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-purple-100 text-purple-700 rounded-[4px] px-[1px]">
        {text.slice(at, at + needle.length)}
      </mark>
      {text.slice(at + needle.length)}
    </>
  )
}

export default function PastRow({ move, meId, highlight, onOpen }: PastRowProps) {
  const tile = pastTile(move.startAt)
  const others = move.people.filter(p => p.id !== meId)
  const extra = move.photoCount - move.thumbs.length
  const showAddHint = move.photoCount === 0 && albumIsOpen(move.startAt)

  return (
    <button onClick={() => onOpen(move)} className="w-full text-left p-3">
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
            <Highlighted text={move.title} q={highlight} />
          </p>
          <p className="font-sans text-[12.5px] leading-snug text-ink-500 mt-0.5 truncate">
            <Highlighted text={pastWhenLine(move.startAt, move.locationText)} q={highlight} />
          </p>
        </div>
      </div>

      {move.thumbs.length > 0 && (
        <div className="grid grid-cols-4 gap-1 mt-2.5">
          {move.thumbs.map((src, i) => (
            <span key={src} className="relative block aspect-square rounded-[10px] overflow-hidden bg-grey-100">
              <img src={src} alt="" className="block w-full h-full object-cover" />
              {i === move.thumbs.length - 1 && extra > 0 && (
                <span className="absolute inset-0 bg-ink-900/50 flex items-center justify-center font-display font-extrabold text-[14px] text-white">
                  +{extra}
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center mt-2.5">
        <AvatarStack people={others} size={20} max={3} overlapClassName="-ml-[7px]" />
        <span className="font-sans text-[11.5px] font-semibold text-ink-500 ml-2 min-w-0 truncate">
          {whoWasInLine(move.people, meId)}
        </span>
        {showAddHint && (
          <span className="ml-auto shrink-0 pl-2 flex items-center gap-[5px] font-sans text-[12px] font-bold text-purple-500">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <path d="M12 8v8M8 12h8" />
            </svg>
            Add photos
          </span>
        )}
      </div>
    </button>
  )
}
