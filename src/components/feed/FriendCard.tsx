'use client'

// Screen 4 friend card. Phase 9: adds the "I'm in" / "You're in" join toggle
// (9.2) + time badge + joiners. Tapping the card body still opens a 1:1 SMS
// thread with that friend (Screen 6); the join button stops propagation.

import Avatar from '@/components/ui/Avatar'
import { posthog } from '@/lib/posthog'
import { timeLabel } from '@/components/go-green/TimeChips'
import Joiners, { type Joiner } from './Joiners'
import AnchoredMoveCard, { type AnchoredMove } from './AnchoredMoveCard'

interface FriendCardProps {
  id: string
  displayName: string | null
  avatarUrl?: string | null
  statusNote?: string | null
  statusTime?: string | null
  anchoredMove?: AnchoredMove | null
  phone: string
  joiners: Joiner[]
  joinedByMe: boolean
  meId: string
  onToggleJoin: (moverId: string, joined: boolean) => void
}

export default function FriendCard({
  id,
  displayName,
  avatarUrl,
  statusNote,
  statusTime,
  anchoredMove,
  phone,
  joiners,
  joinedByMe,
  meId,
  onToggleJoin,
}: FriendCardProps) {
  const time = timeLabel(statusTime)
  const name = displayName ?? 'Friend'

  function handleTapSMS() {
    posthog.capture('feed_friend_tapped')
    posthog.capture('friend_tap_sms_opened')
    window.location.href = `sms:${phone}`
  }

  function handleToggle() {
    posthog.capture(joinedByMe ? 'move_join_removed' : 'move_join_added')
    onToggleJoin(id, joinedByMe)
  }

  return (
    <div className="rounded-[18px] border-[1.5px] border-green-500/25 bg-green-500/[0.09] px-3.5 py-3 mb-2 animate-card-in">
      <div className="flex items-center gap-3">
        <button
          onClick={handleTapSMS}
          aria-label={`Text ${name}`}
          className="flex-1 min-w-0 flex items-center gap-3 text-left"
        >
          <Avatar src={avatarUrl} name={name} size={44} className="shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block font-display font-bold text-[15px] text-ink-900 truncate">{name}</span>
            {(time || statusNote) && (
              <span className="flex items-center gap-1.5 mt-0.5">
                {time && (
                  <span className="shrink-0 font-sans text-[11px] font-semibold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-full">
                    {time}
                  </span>
                )}
                {statusNote && (
                  <span className="font-sans text-[13px] text-ink-500 truncate">{statusNote}</span>
                )}
              </span>
            )}
          </span>
        </button>
        <button
          onClick={handleToggle}
          aria-pressed={joinedByMe}
          className={`shrink-0 px-3.5 py-2 rounded-full font-sans font-bold text-[13px] ${
            joinedByMe ? 'bg-green-700 text-white' : 'bg-purple-500 text-white'
          }`}
        >
          {joinedByMe ? "You're in ✓" : "I'm in"}
        </button>
      </div>

      {anchoredMove && <AnchoredMoveCard move={anchoredMove} />}

      {joiners.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-green-500/20">
          <Joiners joiners={joiners} meId={meId} />
        </div>
      )}
    </div>
  )
}
