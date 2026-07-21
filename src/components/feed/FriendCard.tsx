'use client'

// Screen 4 friend card. Phase 9: adds the "I'm in" / "You're in" join toggle
// (9.2) + time badge + joiners. Tapping the card body still opens a 1:1 SMS
// thread with that friend (Screen 6); the join button stops propagation.
// Phase 16: tapping "I'm in" also opens the 1:1 text in the same tap (#5), and
// tapping "You're in ✓" confirms before dropping the join (#6).

import { useState } from 'react'
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
  const [confirmLeave, setConfirmLeave] = useState(false)

  function openSMS() {
    window.location.href = `sms:${phone}`
  }

  function handleTapSMS() {
    posthog.capture('feed_friend_tapped')
    posthog.capture('friend_tap_sms_opened')
    openSMS()
  }

  function handleJoinButton() {
    if (joinedByMe) {
      // #6 — confirm before dropping the join instead of removing it silently.
      setConfirmLeave(true)
      return
    }
    // #5 — record the join and open the 1:1 text in the same tap.
    posthog.capture('move_join_added')
    onToggleJoin(id, false)
    posthog.capture('join_sms_opened')
    openSMS()
  }

  function confirmLeaveNow() {
    posthog.capture('move_join_removed')
    onToggleJoin(id, true)
    setConfirmLeave(false)
  }

  return (
    <div className="rounded-[18px] border-[1.5px] border-green-500/25 bg-green-500/[0.09] px-3.5 py-3 mb-2 animate-card-in">
      {/* Top row: avatar · name · join button. */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleTapSMS}
          aria-label={`Text ${name}`}
          className="flex-1 min-w-0 flex items-center gap-3 text-left"
        >
          <Avatar src={avatarUrl} name={name} size={44} className="shrink-0" />
          <span className="block flex-1 min-w-0 font-display font-bold text-[15px] text-ink-900 truncate">{name}</span>
        </button>
        <button
          onClick={handleJoinButton}
          aria-pressed={joinedByMe}
          className={`shrink-0 px-3.5 py-2 rounded-full font-sans font-bold text-[13px] ${
            joinedByMe ? 'bg-green-700 text-white' : 'bg-purple-500 text-white'
          }`}
        >
          {joinedByMe ? "You're in ✓" : "I'm in"}
        </button>
      </div>

      {/* Sub-row: time chip + vibe note on their own full-width line (aligned under
          the name, past the 44px avatar), so the note is always readable and wraps. */}
      {(time || statusNote) && (
        <div className="flex items-center gap-2 flex-wrap mt-2 pl-[56px]">
          {time && (
            <span className="shrink-0 font-sans text-[11px] font-semibold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-full">
              {time}
            </span>
          )}
          {statusNote && (
            <span className="font-sans text-[13px] text-ink-500">{statusNote}</span>
          )}
        </div>
      )}

      {anchoredMove && <AnchoredMoveCard move={anchoredMove} />}

      {joiners.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-green-500/20">
          <Joiners joiners={joiners} meId={meId} />
        </div>
      )}

      {/* #6 — leave confirmation (native action-sheet style, mirrors GoGreyConfirm). */}
      {confirmLeave && (
        <>
          <div
            className="fixed inset-0 bg-text-primary/50 z-40"
            onClick={() => setConfirmLeave(false)}
            aria-hidden="true"
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 px-2 pb-11 flex flex-col gap-2 safe-area-pb">
            <div className="rounded-2xl overflow-hidden border border-[#E8E4F5] bg-surface-bg/95 backdrop-blur-xl">
              <p className="font-sans text-[12px] font-medium text-text-secondary text-center px-4 pt-3 pb-1.5 border-b border-[#E8E4F5]">
                Leave this Moove? You&apos;ll drop off {name}&apos;s plan and stop showing as in.
              </p>
              <button
                onClick={confirmLeaveNow}
                className="w-full py-4 font-sans text-[17px] font-semibold text-[#E8405A]"
              >
                Leave
              </button>
            </div>
            <button
              onClick={() => setConfirmLeave(false)}
              className="w-full py-4 rounded-2xl border border-[#E8E4F5] bg-surface-bg/95 backdrop-blur-xl font-sans text-[17px] font-bold text-text-primary"
            >
              Stay in
            </button>
          </div>
        </>
      )}
    </div>
  )
}
