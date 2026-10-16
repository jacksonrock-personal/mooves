'use client'

// One person in a group roster, named and pictured whether or not you are
// friends with them. Two people can share a group without being friends (one
// joined via the invite link) — seeing who they are is the point of a group,
// and the "Add friend" on the right edge is the obvious next step from there.

import Avatar from '@/components/ui/Avatar'
import type { RosterRelation } from '@/app/api/groups/[id]/route'

export interface RosterMember {
  id: string
  displayName: string | null
  avatarUrl: string | null
  isOwner: boolean
  relation: RosterRelation
}

interface RosterRowProps {
  member: RosterMember
  busy: boolean
  onAddFriend: (id: string) => void
}

export default function RosterRow({ member: m, busy, onAddFriend }: RosterRowProps) {
  const isYou = m.relation === 'you'
  const name = isYou ? 'You' : (m.displayName ?? 'Someone')
  return (
    <div className="flex items-center gap-3 px-5 py-2.5 border-t border-[#E8E4F5]">
      <Avatar src={m.avatarUrl} name={m.displayName ?? '?'} size={40} className="shrink-0" />
      <span className="flex-1 min-w-0 font-sans text-[15px] font-medium text-ink-900 truncate">{name}</span>
      {m.isOwner && (
        <span className="shrink-0 font-sans text-[11px] font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
          Owner
        </span>
      )}
      {(m.relation === 'add' || m.relation === 'asked') && (
        // Stays after the tap, greyed — a request must never be ambiguous (R31).
        <button
          onClick={() => onAddFriend(m.id)}
          disabled={m.relation === 'asked' || busy}
          className={`shrink-0 font-sans text-[13px] rounded-full px-3.5 py-2 disabled:opacity-100 ${
            m.relation === 'asked'
              ? 'bg-grey-100 text-ink-500 font-semibold'
              : 'bg-purple-500 text-white font-bold'
          }`}
        >
          {m.relation === 'asked' ? 'Asked' : 'Add friend'}
        </button>
      )}
    </div>
  )
}
