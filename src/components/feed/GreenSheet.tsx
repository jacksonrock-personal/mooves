'use client'

// R17 — "Your green". Everything you can do about your own green, in one sheet
// you open by tapping your own face in the rail.
//
// It replaces MyMoveCard, which sat on the feed the entire time you were green
// holding three controls you touch roughly never. Being green is already said
// by your avatar in the rail, ringed and dashed; it did not need a card too.
//
// ONE sheet, three panes (R16's lesson): the first build stacked green →
// visibility → picker as three bottom sheets, and the middle one existed only
// to hold a chip row that fits perfectly well on the pane it came from. So
// visibility is inline on pane 0, and only Free until and the friend picker
// slide.
//
// The drag hook stays bound to the sheet, so dragging down leaves at any depth.

import { useEffect, useState } from 'react'
import { timeLabel } from '@/components/go-green/TimeChips'
import { useSheetDrag } from '@/lib/useSheetDrag'
import SheetGrabber from '@/components/ui/SheetGrabber'
import PaneTrack from '@/components/ui/PaneTrack'
import AnchoredMoveCard, { type AnchoredMove } from './AnchoredMoveCard'
import FreeUntilPane, { formatUntil } from './FreeUntilPane'
import VisibilityRow from '@/components/visibility/VisibilityRow'
import FriendPickerPane, { type PickableFriend } from '@/components/visibility/FriendPickerPane'
import { posthog } from '@/lib/posthog'

interface Group {
  id: string
  name: string
  emoji: string | null
}

interface GreenSheetProps {
  open: boolean
  onClose: () => void
  statusTime: string | null
  statusExpiresAt: string | null
  anchoredMove: AnchoredMove | null
  groups: Group[]
  friends: PickableFriend[]
  visibleGroupIds: string[]
  visibleUserIds: string[]
  showGroups: boolean
  /** Persists a visibility change to /api/status. */
  onVisibilityChange: (next: {
    visibleGroupIds: string[]
    visibleUserIds: string[]
    showGroups: boolean
  }) => void
  onExpiryChange: (iso: string) => void
  onGoGrey: () => void
}

const PANE_MAIN = 0
const PANE_PICKER = 1
const PANE_FREE_UNTIL = 2

export default function GreenSheet({
  open,
  onClose,
  statusTime,
  statusExpiresAt,
  anchoredMove,
  groups,
  friends,
  visibleGroupIds,
  visibleUserIds,
  showGroups,
  onVisibilityChange,
  onExpiryChange,
  onGoGrey,
}: GreenSheetProps) {
  const [pane, setPane] = useState(PANE_MAIN)
  const drag = useSheetDrag(onClose)

  useEffect(() => {
    if (open) {
      setPane(PANE_MAIN)
      posthog.capture('green_modal_opened')
    }
  }, [open])

  if (!open) return null

  const time = timeLabel(statusTime)
  const until = formatUntil(statusExpiresAt)

  function commitVisibility(next: {
    visibleGroupIds?: string[]
    visibleUserIds?: string[]
    showGroups?: boolean
  }) {
    const merged = {
      visibleGroupIds: next.visibleGroupIds ?? visibleGroupIds,
      visibleUserIds: next.visibleUserIds ?? visibleUserIds,
      showGroups: next.showGroups ?? showGroups,
    }
    // 18.2's invariant, enforced here too: the label is meaningless without a
    // group scope, so it can never be left armed by a change that removes one.
    if (merged.visibleGroupIds.length === 0) merged.showGroups = false
    posthog.capture('green_visibility_edited')
    onVisibilityChange(merged)
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-text-primary/50 z-40"
        style={{ opacity: drag.scrimOpacity }}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* ONE fixed height. A pane sliding in must never resize the frame — that
          is R9's rule and the whole reason panes are legal here at all. */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-card-white rounded-t-3xl flex flex-col h-[68%]"
        role="dialog"
        aria-modal="true"
        aria-label="Your green"
        {...drag.sheetProps}
      >
        <SheetGrabber drag={drag} className="mt-[18px]" />

        <PaneTrack pane={pane}>
          {/* ── pane 0 — Your green ─────────────────────────────────────── */}
          <>
            <div className="shrink-0 px-5 pb-1" {...drag.headerProps}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0 shadow-[0_0_0_4px_rgba(46,204,113,0.16)]" />
                <h2 className="font-display font-extrabold text-[18px] text-green-700 tracking-tight">
                  You&apos;re free
                </h2>
                {time && (
                  <span className="ml-auto font-sans text-[12px] font-semibold text-purple-700 bg-purple-100 px-2.5 py-1 rounded-full">
                    {time}
                  </span>
                )}
              </div>
              <p className="font-sans text-[13.5px] text-ink-500 leading-relaxed mb-4">
                Nobody is waiting on you. This is just where you change it.
              </p>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5" {...drag.contentProps}>
              {/* Hidden for legacy greens that have no expiry at all. */}
              {until && (
                <button
                  type="button"
                  onClick={() => setPane(PANE_FREE_UNTIL)}
                  className="w-full flex items-center gap-2.5 rounded-[14px] border border-[#E8E4F5] bg-surface-bg px-3.5 py-3 text-left mb-5"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="text-purple-500 shrink-0">
                    <circle cx="12" cy="12" r="9" />
                    <polyline points="12 7 12 12 15.5 14" />
                  </svg>
                  <span className="font-sans text-[12.5px] font-semibold text-ink-500">Free until</span>
                  <span className="ml-auto font-sans text-[12.5px] font-semibold text-ink-900">{until}</span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="text-grey-300 shrink-0">
                    <polyline points="9 5 16 12 9 19" />
                  </svg>
                </button>
              )}

              <p className="font-sans text-[11px] font-semibold text-ink-500 uppercase tracking-[0.08em] mb-2.5">
                Who can see this?
              </p>
              <VisibilityRow
                groups={groups}
                selectedGroupIds={visibleGroupIds}
                selectedUserIds={visibleUserIds}
                showGroups={showGroups}
                onGroupsChange={ids => commitVisibility({ visibleGroupIds: ids })}
                onUserIdsChange={ids => commitVisibility({ visibleUserIds: ids })}
                onShowGroupsChange={on => commitVisibility({ showGroups: on })}
                onPickFriends={() => {
                  posthog.capture('visibility_friends_opened', { surface: 'green' })
                  setPane(PANE_PICKER)
                }}
              />

              {anchoredMove && <AnchoredMoveCard move={anchoredMove} />}
            </div>

            <div className="shrink-0 px-5 pt-3 border-t border-grey-100 [--safe-pb-base:1.375rem] safe-area-pb">
              <button
                type="button"
                onClick={onGoGrey}
                className="w-full py-[15px] rounded-2xl bg-surface-bg text-ink-500 font-sans font-semibold text-[15px]"
              >
                Go grey
              </button>
            </div>
          </>

          {/* ── pane 1 — the friend picker ──────────────────────────────── */}
          <FriendPickerPane
            friends={friends}
            selected={visibleUserIds}
            active={pane === PANE_PICKER}
            onCancel={() => setPane(PANE_MAIN)}
            onDone={ids => {
              posthog.capture('visibility_friends_confirmed', { count: ids.length, surface: 'green' })
              commitVisibility({ visibleUserIds: ids })
              setPane(PANE_MAIN)
            }}
          />

          {/* ── pane 2 — free until ─────────────────────────────────────── */}
          <FreeUntilPane
            currentExpiresAt={statusExpiresAt}
            onBack={() => setPane(PANE_MAIN)}
            onPick={iso => {
              onExpiryChange(iso)
              setPane(PANE_MAIN)
            }}
          />
        </PaneTrack>
      </div>
    </>
  )
}
