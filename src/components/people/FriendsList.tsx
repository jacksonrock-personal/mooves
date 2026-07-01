'use client'

// Screen 8: Friends list — implementation pending

interface Friend {
  id: string
  displayName: string | null
  avatarUrl: string | null
}

interface FriendsListProps {
  friends: Friend[]
  onRemove: (id: string) => void
}

export default function FriendsList({ friends, onRemove }: FriendsListProps) {
  return (
    <ul className="font-sans">
      {friends.map(f => (
        <li key={f.id} className="py-3 border-b border-gray-100">
          <span>{f.displayName}</span>
          <button onClick={() => onRemove(f.id)} className="ml-auto text-red-500 text-sm">
            Remove
          </button>
        </li>
      ))}
    </ul>
  )
}
