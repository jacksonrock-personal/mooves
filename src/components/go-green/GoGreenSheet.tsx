'use client'

// Screen 5: Go Green Sheet — when, free-until, and who can see it.
// R22 — opened by tapping your OWN tile in the rail, which is now the only way
// to go free (the swipe of amendment A1 is deleted). The "I'm free" button here
// is still the commit, and always was: the slide only ever opened this sheet,
// which is why replacing a drag with a tap costs no protection against an
// accidental green.
//
// R16 — visibility can now name a PERSON, via a pane rather than a second sheet.
// R17 — the deadline is visible BEFORE you commit, and adjustable, instead of
//       being something you discover on the card afterwards.

import { useEffect, useState } from 'react'
import { useKeyboardInset } from '@/lib/useKeyboardInset'
import { useSheetDrag } from '@/lib/useSheetDrag'
import SheetGrabber from '@/components/ui/SheetGrabber'
import PaneTrack from '@/components/ui/PaneTrack'
import TimeChips, { type StatusTime } from './TimeChips'
import VisibilityRow from '@/components/visibility/VisibilityRow'
import FriendPickerPane, { type PickableFriend } from '@/components/visibility/FriendPickerPane'
import FreeUntilPane, { formatUntil } from '@/components/feed/FreeUntilPane'
import { computeExpiresAt } from '@/lib/greenExpiry'
import { posthog } from '@/lib/posthog'

interface Group {
  id: string
  name: string
  emoji: string
}

interface AnchoredMove {
  id: string
  title: string
  brand: string | null
  timeText: string | null
}

interface GoGreenSheetProps {
  open: boolean
  onClose: () => void
  groups: Group[]
  friends: PickableFriend[]
  anchoredMove?: AnchoredMove | null
  onSuccess: (move: {
    statusNote: string | null
    statusTime: string | null
    visibleGroupIds: string[]
    visibleUserIds: string[]
    showGroups: boolean
    expiresAt: string | null
  }) => void
}

const PANE_MAIN = 0
const PANE_PICKER = 1
const PANE_FREE_UNTIL = 2

export default function GoGreenSheet({
  open,
  onClose,
  groups,
  friends,
  anchoredMove,
  onSuccess,
}: GoGreenSheetProps) {
  const [time, setTime] = useState<StatusTime | null>(null)
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [showGroups, setShowGroups] = useState(false) // 18.2 — per-moove, default off
  /**
   * R17 — the expiry, as a value you can see and change before committing.
   *
   * NULL means "whatever the chip implies", which is what `computeExpiresAt`
   * returns. Touching the Free-until pane pins it, and changing the chip
   * un-pins it again — otherwise picking "Tonight" after having nudged the
   * deadline would leave a deadline that no longer matches the window.
   */
  const [pinnedExpiry, setPinnedExpiry] = useState<string | null>(null)
  const [pane, setPane] = useState(PANE_MAIN)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const keyboardInset = useKeyboardInset(open)
  const drag = useSheetDrag(onClose)

  useEffect(() => {
    if (open) {
      setTime(null)
      setSelectedGroupIds([])
      setSelectedUserIds([])
      setShowGroups(false)
      setPinnedExpiry(null)
      setPane(PANE_MAIN)
      setError(null)
    }
  }, [open])

  if (!open) return null

  const expiresAt = pinnedExpiry ?? computeExpiresAt(time).toISOString()
  const untilLabel = formatUntil(expiresAt)

  function handleGroupsChange(ids: string[]) {
    setSelectedGroupIds(ids)
    if (ids.length === 0) setShowGroups(false)
  }

  async function handleConfirm() {
    if (submitting) return
    setSubmitting(true)
    setError(null)

    const visibleTo = selectedGroupIds.length > 0 ? selectedGroupIds : null
    const visibleUserIds = selectedUserIds.length > 0 ? selectedUserIds : null

    try {
      const res = await fetch('/api/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isAvailable: true,
          statusNote: null,
          statusTime: time,
          visibleTo,
          visibleUserIds,
          statusMoveId: anchoredMove?.id ?? null,
          // 9.5 Part A — expiry computed here on the viewer's local clock
          statusExpiresAt: expiresAt,
          statusShowGroups: showGroups, // 18.2
        }),
      })
      if (!res.ok) throw new Error('update failed')
      const data = (await res.json()) as {
        statusNote: string | null
        statusTime: string | null
        visibleTo: string[] | null
        visibleUserIds: string[] | null
      }

      posthog.capture('go_green_confirmed')
      if (time) posthog.capture('go_green_with_time')
      if (visibleTo) posthog.capture('go_green_with_groups')
      if (visibleUserIds) posthog.capture('go_green_with_friends', { count: selectedUserIds.length })
      if (visibleTo && showGroups) posthog.capture('go_green_with_group_label')
      if (anchoredMove) posthog.capture('go_green_with_move', { move: anchoredMove.id })

      onSuccess({
        statusNote: data.statusNote,
        statusTime: data.statusTime,
        // Report what the SERVER stored. R16 drops ids that are not real
        // friendships, so echoing the local list could claim an audience that
        // was never saved.
        visibleGroupIds: data.visibleTo ?? [],
        visibleUserIds: data.visibleUserIds ?? [],
        showGroups: !!data.visibleTo && showGroups,
        expiresAt,
      })
    } catch {
      setError("Couldn't update, try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-text-primary/50 z-40"
        style={{ opacity: drag.scrimOpacity }}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* One fixed height, so a pane sliding in never resizes the frame (R9). */}
      <div
        className="fixed left-0 right-0 z-50 bg-card-white rounded-t-3xl flex flex-col h-[72%]"
        role="dialog"
        aria-modal="true"
        aria-label="Go green"
        {...drag.sheetProps}
        // Merged, not replaced: sheetProps.style carries the drag transform, and
        // clobbering it would leave the sheet unable to follow a thumb.
        style={{ ...drag.sheetProps.style, bottom: keyboardInset }}
      >
        <SheetGrabber drag={drag} className="mt-[18px]" />

        <PaneTrack pane={pane}>
          {/* ── pane 0 — the form ───────────────────────────────────────── */}
          <>
            <div className="flex-1 min-h-0 overflow-y-auto px-5" {...drag.contentProps}>
              {anchoredMove && (
                <div className="flex items-center gap-3 border border-[#E8E4F5] rounded-2xl p-3 bg-purple-50 mb-5">
                  <span className="w-9 h-9 rounded-[10px] bg-purple-100 flex items-center justify-center shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 18V5l12-2v13" stroke="#7C5CDB" strokeWidth="2" strokeLinejoin="round" /><circle cx="6" cy="18" r="3" stroke="#7C5CDB" strokeWidth="2" /><circle cx="18" cy="16" r="3" stroke="#7C5CDB" strokeWidth="2" /></svg>
                  </span>
                  <div className="min-w-0">
                    <div className="font-sans font-bold text-[13.5px] text-ink-900 leading-tight truncate">{anchoredMove.title}</div>
                    <div className="font-sans text-[11.5px] text-ink-500 mt-0.5 truncate">
                      {[anchoredMove.brand ? `Sponsored · ${anchoredMove.brand}` : 'Sponsored', anchoredMove.timeText].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </div>
              )}

              {/* The vibe note is gone from this sheet on purpose. Going free
                  should ask only for decisions you want made BEFORE friends can
                  see you: who can see it, for how long, and roughly when. */}
              <p className="font-sans text-[11px] font-semibold text-ink-500 uppercase tracking-[0.08em] mb-2.5">
                When?
              </p>
              <div className="mb-4">
                <TimeChips
                  selected={time}
                  onChange={next => {
                    setTime(next)
                    // A new window implies a new deadline. Keeping a pinned one
                    // would leave "Right now" expiring at 3am.
                    setPinnedExpiry(null)
                  }}
                />
              </div>

              {/* R17 — the deadline, before you commit rather than after. */}
              {untilLabel && (
                <button
                  type="button"
                  onClick={() => {
                    posthog.capture('free_until_seen_at_setup')
                    setPane(PANE_FREE_UNTIL)
                  }}
                  className="w-full flex items-center gap-2.5 rounded-2xl border-[1.5px] border-[#E8E4F5] bg-purple-50 px-3.5 py-3 mb-5 text-left"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="text-purple-500 shrink-0">
                    <circle cx="12" cy="12" r="9" />
                    <polyline points="12 7 12 12 15.5 14" />
                  </svg>
                  <span className="font-sans text-[12.5px] font-semibold text-ink-500">Free until</span>
                  <span className="ml-auto font-sans text-[13px] font-bold text-ink-900">{untilLabel}</span>
                  <span className="font-sans text-[11.5px] font-semibold text-purple-500">Change</span>
                </button>
              )}

              <p className="font-sans text-[11px] font-semibold text-ink-500 uppercase tracking-[0.08em] mb-2.5">
                Who can see this?
              </p>
              <VisibilityRow
                groups={groups}
                selectedGroupIds={selectedGroupIds}
                selectedUserIds={selectedUserIds}
                showGroups={showGroups}
                onGroupsChange={handleGroupsChange}
                onUserIdsChange={setSelectedUserIds}
                onShowGroupsChange={setShowGroups}
                onPickFriends={() => {
                  posthog.capture('visibility_friends_opened', { surface: 'gogreen' })
                  setPane(PANE_PICKER)
                }}
              />

              {error && <p className="font-sans text-[13px] text-red-500 mb-2">{error}</p>}
            </div>

            <div className="shrink-0 px-5 pt-3 border-t border-grey-100 [--safe-pb-base:1.375rem] safe-area-pb">
              <button
                onClick={() => void handleConfirm()}
                disabled={submitting}
                className="w-full py-4 rounded-2xl bg-green-700 text-white font-display font-extrabold text-[17px] tracking-tight shadow-[0_4px_20px_rgba(22,122,67,0.28)] disabled:opacity-60"
              >
                {submitting ? 'Saving…' : "I'm free"}
              </button>
            </div>
          </>

          {/* ── pane 1 — the friend picker ──────────────────────────────── */}
          <FriendPickerPane
            friends={friends}
            selected={selectedUserIds}
            active={pane === PANE_PICKER}
            onCancel={() => setPane(PANE_MAIN)}
            onDone={ids => {
              posthog.capture('visibility_friends_confirmed', { count: ids.length, surface: 'gogreen' })
              setSelectedUserIds(ids)
              setPane(PANE_MAIN)
            }}
          />

          {/* ── pane 2 — free until ─────────────────────────────────────── */}
          <FreeUntilPane
            currentExpiresAt={expiresAt}
            onBack={() => setPane(PANE_MAIN)}
            onPick={iso => {
              setPinnedExpiry(iso)
              setPane(PANE_MAIN)
            }}
          />
        </PaneTrack>
      </div>
    </>
  )
}
