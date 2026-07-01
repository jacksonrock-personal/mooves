'use client'

// Shared create/edit group form — implementation pending (Phase 1 Screen 9)

interface Friend {
  id: string
  displayName: string | null
  avatarUrl?: string | null
}

interface GroupFormProps {
  initialName?: string
  initialEmoji?: string
  initialMemberIds?: string[]
  friends: Friend[]
  onSave: (name: string, emoji: string, memberIds: string[]) => void
  onCancel: () => void
}

export default function GroupForm({
  initialName = '',
  initialEmoji = '👥',
  initialMemberIds = [],
  onSave,
  onCancel,
}: GroupFormProps) {
  return (
    <div className="font-sans p-4">
      <p className="text-text-secondary">Group form — coming soon</p>
      <button onClick={() => onSave(initialName || 'Group', initialEmoji, initialMemberIds)} className="mt-4">
        Save
      </button>
      <button onClick={onCancel} className="mt-2 text-text-secondary">Cancel</button>
    </div>
  )
}
