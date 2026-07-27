'use client'

// Phase 20.6 — the joiner row, expandable.
//
// Fixes a real gap: before this, you could not see who had joined until AFTER
// you committed and the group text opened. The roster is a decision input, so it
// belongs on the card, before the decision.
//
// Collapsed by default so cards stay short. Shared by green cards and Moove
// cards, because they should answer "who's in?" identically.

import { useState } from 'react'
import Avatar from '@/components/ui/Avatar'
import { posthog } from '@/lib/posthog'

export interface WhosInPerson {
  id: string
  displayName: string | null
  avatarUrl?: string | null
}

interface WhosInProps {
  people: WhosInPerson[]
  meId?: string
  /** Shown first and tagged — the green's mover or the Moove's author. */
  hostId?: string
  hostLabel?: string
  /** Tints the divider to match a green card. */
  tone?: 'green' | 'plain'
}

export default function WhosIn({
  people,
  meId,
  hostId,
  hostLabel = 'Host',
  tone = 'plain',
}: WhosInProps) {
  const [open, setOpen] = useState(false)
  if (people.length === 0) return null

  // Host first, then join order as given.
  const ordered = hostId
    ? [...people].sort((a, b) => (a.id === hostId ? -1 : b.id === hostId ? 1 : 0))
    : people

  function toggle() {
    if (!open) posthog.capture('whos_in_expanded', { count: people.length })
    setOpen(o => !o)
  }

  return (
    <div className={`mt-2.5 pt-2.5 border-t ${tone === 'green' ? 'border-green-500/20' : 'border-grey-100'}`}>
      <button
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center gap-2 text-left"
      >
        <div className="flex shrink-0">
          {ordered.slice(0, 3).map((p, i) => (
            <Avatar
              key={p.id}
              src={p.avatarUrl}
              name={p.displayName ?? '?'}
              size={23}
              className={`ring-2 ring-white ${i > 0 ? '-ml-2' : ''}`}
            />
          ))}
        </div>
        <span className="flex-1 font-sans text-[11.5px] font-semibold text-ink-500">
          {people.length} in
        </span>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          className={`shrink-0 text-ink-500 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <ul className="mt-2">
          {ordered.map(p => (
            <li key={p.id} className="flex items-center gap-2.5 py-1.5">
              <Avatar src={p.avatarUrl} name={p.displayName ?? '?'} size={26} className="shrink-0" />
              <span className="flex-1 min-w-0 font-sans text-[13px] text-ink-900 truncate">
                {meId && p.id === meId ? 'You' : (p.displayName ?? 'Someone')}
              </span>
              {hostId && p.id === hostId && (
                <span className="shrink-0 font-sans text-[10px] font-bold uppercase tracking-[0.06em] text-ink-500">
                  {hostLabel}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
