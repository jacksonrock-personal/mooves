'use client'

// Phase 9.2 — presence row: stacked joiner avatars + a names/count summary.
// Joins are visible to everyone viewing the card. The viewer shows as "you".

import Avatar from '@/components/ui/Avatar'

export interface Joiner {
  id: string
  displayName: string | null
  avatarUrl?: string | null
}

interface JoinersProps {
  joiners: Joiner[]
  meId?: string
}

function nameOf(j: Joiner, meId?: string): string {
  if (meId && j.id === meId) return 'you'
  return j.displayName ?? 'Someone'
}

export default function Joiners({ joiners, meId }: JoinersProps) {
  if (joiners.length === 0) return null

  const names = joiners.map(j => nameOf(j, meId))
  let summary: string
  if (joiners.length === 1) {
    summary = `${names[0]} is in`
  } else if (joiners.length === 2) {
    summary = `${names[0]}, ${names[1]} are in`
  } else {
    summary = `${names[0]}, ${names[1]} +${joiners.length - 2} in`
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex">
        {joiners.slice(0, 3).map((j, i) => (
          <Avatar
            key={j.id}
            src={j.avatarUrl}
            name={j.displayName ?? '?'}
            size={26}
            className={`ring-2 ring-white ${i > 0 ? '-ml-1.5' : ''}`}
          />
        ))}
      </div>
      <span className="font-sans text-[13px] text-ink-900">
        <span className="font-semibold">{summary}</span>
      </span>
    </div>
  )
}
