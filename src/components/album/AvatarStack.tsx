'use client'

// R36 — the overlapping face stack used on Past rows and the album header.
// Same anatomy as PlanCard's foot: white ring, negative overlap.

import Avatar from '@/components/ui/Avatar'
import type { AlbumPerson } from '@/lib/photos'

interface AvatarStackProps {
  people: AlbumPerson[]
  size: number
  max?: number
  /** Tailwind negative-margin class for the overlap, e.g. "-ml-[7px]". */
  overlapClassName: string
}

export default function AvatarStack({ people, size, max = 4, overlapClassName }: AvatarStackProps) {
  const shown = people.slice(0, max)
  if (shown.length === 0) return null
  return (
    <span className="flex shrink-0">
      {shown.map((p, i) => (
        <Avatar
          key={p.id}
          src={p.avatarUrl}
          name={p.displayName ?? '?'}
          size={size}
          className={`ring-2 ring-white ${i > 0 ? overlapClassName : ''}`}
        />
      ))}
    </span>
  )
}
