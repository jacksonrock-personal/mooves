'use client'

// R39 (replaces R36's collapsed "Past ⌄" toggle) — the foot of the feed.
//
// Always open, and it says what it is: a real heading, one line on why you'd
// look, the two most recent past Mooves, and a pill that says where it goes.
// Tapping a row opens its album straight over the feed. The whole history,
// searchable and paged, lives on /past.
//
// It does not render at all until there is a past Moove (R31's
// no-empty-furniture rule) — the caller passes an empty list and gets nothing.

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { posthog } from '@/lib/posthog'
import type { PastMoove } from '@/lib/photos'
import PastRow from './PastRow'

interface PastSectionProps {
  moves: PastMoove[]
  meId: string
  onOpen: (move: PastMoove) => void
}

export default function PastSection({ moves, meId, onOpen }: PastSectionProps) {
  const shownRef = useRef(false)
  const hasMoves = moves.length > 0

  useEffect(() => {
    if (!hasMoves || shownRef.current) return
    shownRef.current = true
    posthog.capture('past_preview_shown')
  }, [hasMoves])

  if (!hasMoves) return null

  return (
    <section className="mt-3.5 pt-4 border-t border-[#E8E4F5]">
      <div className="px-0.5 pb-2.5">
        <h2 className="font-display font-extrabold text-[16px] tracking-tight text-ink-900">Past Mooves</h2>
        <p className="font-sans text-[12.5px] leading-snug text-ink-500 mt-0.5">
          The Mooves you went to, and the photos from them.
        </p>
      </div>

      <div className="rounded-2xl border-[1.5px] border-[#E8E4F5] bg-white overflow-hidden divide-y divide-grey-100">
        {moves.map(m => (
          <PastRow
            key={m.id}
            move={m}
            meId={meId}
            onOpen={move => {
              posthog.capture('past_album_opened', { source: 'feed' })
              onOpen(move)
            }}
          />
        ))}
      </div>

      <Link
        href="/past"
        onClick={() => posthog.capture('past_see_all_tapped')}
        className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-3 rounded-full bg-purple-100 text-purple-700 font-sans font-bold text-[13.5px]"
      >
        See all past Mooves
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Link>
    </section>
  )
}
