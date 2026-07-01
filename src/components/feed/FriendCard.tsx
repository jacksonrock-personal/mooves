'use client'

// Screen 4 friend card + Screen 6: tap opens native SMS thread — no in-app profile.

import Avatar from '@/components/ui/Avatar'
import { posthog } from '@/lib/posthog'

interface FriendCardProps {
  id: string
  displayName: string
  avatarUrl?: string | null
  statusNote?: string | null
  phone: string
}

export default function FriendCard({ displayName, avatarUrl, statusNote, phone }: FriendCardProps) {
  function handleTap() {
    posthog.capture('feed_friend_tapped')
    posthog.capture('friend_tap_sms_opened')
    window.location.href = `sms:${phone}`
  }

  return (
    <button
      onClick={handleTap}
      className="w-full flex items-center gap-3 rounded-[18px] border-[1.5px] border-[#2ECC71]/40 bg-[#2ECC71]/[0.14] px-4 py-3.5 mb-2 text-left animate-card-in"
      aria-label={`Text ${displayName}`}
    >
      <Avatar src={avatarUrl} name={displayName} size={46} className="shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block font-display font-bold text-[15px] text-text-primary truncate">
          {displayName}
        </span>
        {statusNote && (
          <span className="block font-sans text-[13px] text-text-secondary truncate">
            {statusNote}
          </span>
        )}
      </span>
      <span className="shrink-0 text-[#2ECC71]/[0.4] text-xl">&rsaquo;</span>
    </button>
  )
}
