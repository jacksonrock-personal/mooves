'use client'

// Screen 8: presentational friend list — renders rows, or the search
// no-results state when a query matches nothing.

import FriendRow from './FriendRow'

interface Friend {
  id: string
  displayName: string | null
  avatarUrl: string | null
}

interface FriendsListProps {
  friends: Friend[]
  query: string
  onRemove: (id: string, displayName: string | null) => void
}

export default function FriendsList({ friends, query, onRemove }: FriendsListProps) {
  if (friends.length === 0 && query.trim()) {
    return (
      <div className="flex-1 bg-surface-bg">
        <div className="px-5 py-8 text-center">
          <p className="font-sans text-[14px] text-text-secondary">
            No friends named{' '}
            <span className="font-semibold text-text-primary">&quot;{query}&quot;</span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      {friends.map(f => (
        <FriendRow
          key={f.id}
          id={f.id}
          displayName={f.displayName}
          avatarUrl={f.avatarUrl}
          onRemove={onRemove}
        />
      ))}
      <p className="font-sans text-[11px] text-text-secondary/70 text-center px-5 pt-2 pb-1 bg-white">
        Swipe left on any friend to remove them
      </p>
    </div>
  )
}
