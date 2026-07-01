'use client'

// Green friend card — tapping opens native SMS

interface FriendCardProps {
  id: string
  displayName: string
  avatarUrl?: string | null
  statusNote?: string | null
  phone: string
}

export default function FriendCard({ displayName, avatarUrl, statusNote, phone }: FriendCardProps) {
  const handleTap = () => {
    window.location.href = `sms:${phone}`
  }

  return (
    <button
      onClick={handleTap}
      className="w-full text-left font-sans"
      aria-label={`Text ${displayName}`}
    >
      <span className="font-semibold">{displayName}</span>
      {statusNote && <span className="text-sm text-text-secondary ml-2">{statusNote}</span>}
    </button>
  )
}
