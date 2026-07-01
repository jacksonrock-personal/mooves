'use client'

import Avatar from '@/components/ui/Avatar'

interface FriendRowProps {
  id: string
  displayName: string | null
  avatarUrl?: string | null
  onRemove?: (id: string) => void
}

export default function FriendRow({ id, displayName, avatarUrl, onRemove }: FriendRowProps) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100">
      <Avatar src={avatarUrl} name={displayName} size={36} />
      <span className="flex-1 font-sans font-medium">{displayName}</span>
      {onRemove && (
        <button
          onClick={() => onRemove(id)}
          className="text-sm text-red-500 font-sans"
          aria-label={`Remove ${displayName}`}
        >
          Remove
        </button>
      )}
    </div>
  )
}
