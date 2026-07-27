'use client'

// Screen 4 friend card. Phase 9: adds the "I'm in" / "You're in" join toggle
// (9.2) + time badge + joiners. Tapping the card body still opens a 1:1 SMS
// thread with that friend (Screen 6); the join button stops propagation.
// Phase 16: tapping "I'm in" also opens the 1:1 text in the same tap (#5), and
// tapping "You're in ✓" confirms before dropping the join (#6).

import { useState } from 'react'
import { posthog } from '@/lib/posthog'
import { timeLabel } from '@/components/go-green/TimeChips'
import { type Joiner } from './Joiners'
import WhosIn from './WhosIn'
import AnchoredMoveCard, { type AnchoredMove } from './AnchoredMoveCard'
import GroupLabel from './GroupLabel'

interface FriendCardProps {
  id: string
  displayName: string | null
  avatarUrl?: string | null
  statusNote?: string | null
  statusTime?: string | null
  /** 18.2 — group names this viewer is entitled to see; already intersected server-side. */
  visibleGroups?: string[]
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
  visibleGroups,
  anchoredMove,
  phone,
  joiners,
  joinedByMe,
  meId,
  onToggleJoin,
}: FriendCardProps) {
  const time = timeLabel(statusTime)
  const name = displayName ?? 'Friend'
  const groupNames = visibleGroups ?? []
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
      {/* Phase 20: this card is the expanded state of a rail avatar, so it does
          NOT repeat the avatar — the rail is showing the same face 8px above it,
          which read as duplication on device. The whole content area is now one
          tap target for the SMS handoff: the note used to sit outside the
          button, so tapping the actual content did nothing. */}
      <div className="flex items-start gap-3">
        <button
          onClick={handleTapSMS}
          aria-label={`Text ${name}`}
          className="flex-1 min-w-0 text-left"
        >
          <span className="flex items-center gap-2">
            <span className="font-display font-bold text-[15px] text-ink-900 truncate">{name}</span>
            {time && (
              <span className="shrink-0 font-sans text-[11px] font-semibold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-full">
                {time}
              </span>
            )}
          </span>
          {statusNote && (
            <span className="block font-sans text-[13px] text-ink-500 mt-1">{statusNote}</span>
          )}
          <span className="flex items-center gap-1.5 mt-1.5 font-sans text-[11.5px] font-semibold text-purple-700">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            Tap to text {name}
          </span>
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

      {groupNames.length > 0 && (
        <div className="mt-2">
          <GroupLabel groups={groupNames} />
        </div>
      )}

      {anchoredMove && <AnchoredMoveCard move={anchoredMove} />}

      {/* 20.6 — collapsed by default, tap to name everyone. The roster is a
          decision input, so it belongs here rather than only in the group text. */}
      <WhosIn people={joiners} meId={meId} hostId={id} hostLabel="Free" tone="green" />

      {/* #6 — leave confirmation (native action-sheet style, mirrors GoGreyConfirm). */}
      {confirmLeave && (
        <>
          <div
            className="fixed inset-0 bg-text-primary/50 z-40"
            onClick={() => setConfirmLeave(false)}
            aria-hidden="true"
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 px-2 [--safe-pb-base:2.75rem] flex flex-col gap-2 safe-area-pb">
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
