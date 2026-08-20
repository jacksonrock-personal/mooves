'use client'

// Screen 8 content, embedded under the People tab's Friends sub-tab.
// Search + friend list + swipe-to-remove + sticky invite button.
// The People header, sub-tabs, and bottom nav live in PeopleScreen.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { initPostHog, posthog } from '@/lib/posthog'
import { useSheetDrag } from '@/lib/useSheetDrag'
import SheetGrabber from '@/components/ui/SheetGrabber'
import CowIllustration from '@/components/ui/CowIllustration'
import PeopleDiscovery from './PeopleDiscovery'
import Toast from '@/components/ui/Toast'
import FriendsList from './FriendsList'
import FriendWeekSheet from './FriendWeekSheet'

interface Friend {
  id: string
  displayName: string | null
  avatarUrl: string | null
  /** R25 — scoped count of slots set this week, or null if there is none to show. */
  weekCount?: number | null
}

export default function FriendsPanel() {
  const router = useRouter()
  const [friends, setFriends] = useState<Friend[] | null>(null)
  const [query, setQuery] = useState('')
  const [removeTarget, setRemoveTarget] = useState<Friend | null>(null)
  // R25 — whose week is open. Same sheet the rail uses, second door.
  const [weekFriendId, setWeekFriendId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const searchFired = useRef(false)

  // R31 — lifted out of the effect below so accepting a friend request can
  // reuse it. A new friendship has to land in this list immediately; refetching
  // is simpler and more honest than splicing a row in from the accept response,
  // which would have to invent the week count.
  const reloadFriends = useCallback(async () => {
    try {
      const res = (await fetch('/api/friends').then(r => r.json())) as { friends: Friend[] }
      setFriends(sortFriends(res.friends ?? []))
    } catch {
      // Leave the list as it was. A failed refresh after an accept means one
      // stale list, not a broken screen.
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function init() {
      initPostHog()
      posthog.capture('friends_list_viewed')

      // Phase 19: the referral code moved to the Add friends hub, which owns
      // every invite path now, so this panel only needs the list itself.
      const friendsRes = (await fetch('/api/friends').then(r => r.json())) as { friends: Friend[] }
      if (cancelled) return

      setFriends(sortFriends(friendsRes.friends ?? []))
    }

    void init()
    return () => {
      cancelled = true
    }
  }, [])

  function handleQueryChange(value: string) {
    if (!searchFired.current && value.trim()) {
      posthog.capture('friends_list_search_used')
      searchFired.current = true
    }
    setQuery(value)
  }

  function handleRemoveInitiated(id: string, displayName: string | null) {
    const target = (friends ?? []).find(f => f.id === id)
    posthog.capture('friends_remove_initiated')
    setRemoveTarget(target ?? { id, displayName, avatarUrl: null })
  }

  // R6 — the remove-confirmation sheet draws a grabber, so it drags.
  const removeDrag = useSheetDrag(() => setRemoveTarget(null))

  function handleCancelRemove() {
    posthog.capture('friends_remove_cancelled')
    setRemoveTarget(null)
  }

  async function handleConfirmRemove() {
    if (!removeTarget) return
    const target = removeTarget
    setRemoveTarget(null)
    posthog.capture('friends_remove_confirmed')

    // Optimistic removal.
    setFriends(prev => (prev ?? []).filter(f => f.id !== target.id))

    try {
      const res = await fetch(`/api/friendships/${target.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
    } catch {
      // Restore the row and let the user know.
      setFriends(prev => sortFriends([...(prev ?? []), target]))
      setToastMessage(`Couldn't remove ${target.displayName ?? 'friend'}, try again.`)
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return friends ?? []
    return (friends ?? []).filter(f => (f.displayName ?? '').toLowerCase().includes(q))
  }, [friends, query])

  const loaded = friends !== null
  const count = friends?.length ?? 0

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Search — hidden until at least one friend exists */}
      {loaded && count > 0 && (
        <div className="bg-card-white px-4 pt-2.5 pb-3 border-b border-[#E8E4F5] shrink-0">
          <div className="relative flex items-center">
            <svg
              className="absolute left-[11px] text-text-secondary pointer-events-none"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              placeholder="Search friends"
              className={`w-full bg-surface-bg rounded-xl py-2.5 pl-9 pr-3.5 font-sans text-[16px] text-text-primary outline-none border-[1.5px] ${
                query.trim() ? 'border-mooves-purple' : 'border-[#E8E4F5]'
              }`}
            />
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 flex flex-col pb-[calc(var(--nav-h)+95px+22px+env(safe-area-inset-bottom))]">
        {/* R31 — requests and suggestions, ABOVE the friend list. Both sections
            render nothing at all when empty, so a user with neither sees the
            panel exactly as it was before this release. It sits outside the
            count===0 branch below on purpose: an incoming request is worth
            showing even to somebody whose own list is empty. */}
        {loaded && (
          <PeopleDiscovery
            onFriendAdded={() => void reloadFriends()}
            onToast={setToastMessage}
          />
        )}
        {loaded &&
          (count === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <CowIllustration size={72} className="mb-5" />
              <p className="font-display font-extrabold text-[19px] text-text-primary tracking-tight mb-2">
                Nobody here yet.
              </p>
              <p className="font-sans text-[14px] text-text-secondary leading-relaxed">
                Invite your people, and they&apos;ll show up here.
              </p>
            </div>
          ) : (
            <FriendsList
              friends={filtered}
              query={query}
              onRemove={handleRemoveInitiated}
              onOpenWeek={id => {
                posthog.capture('friends_row_week_opened')
                setWeekFriendId(id)
              }}
            />
          ))}
      </div>

      {/* R25 — the second door onto the same sheet the rail opens. */}
      <FriendWeekSheet
        friendId={weekFriendId}
        fallbackName={(friends ?? []).find(f => f.id === weekFriendId)?.displayName ?? null}
        fallbackAvatar={(friends ?? []).find(f => f.id === weekFriendId)?.avatarUrl ?? null}
        onClose={() => setWeekFriendId(null)}
      />

      {/* Sticky add button (above bottom nav).
          Phase 19: this was "Invite friends", which fired the share sheet
          directly. It now opens the Add friends hub, which offers the in-person
          code, a personal QR, and that same share action — one entry with three
          paths instead of two competing buttons in one bar. */}
      {/* ⚠ pb-[34px], not py-2.5. Sitting this bar at exactly --nav-h is not
          enough: the Plan disc is lifted 26px ABOVE the nav's top edge and the
          nav paints after this bar, so the cow landed on top of the button. The
          device test found it burying "New group" outright. The extra bottom
          padding lifts the button clear while the bar's white background runs on
          underneath, so the disc rests on it exactly as it does on the nav. */}
      <div className="fixed bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] left-0 right-0 z-30 bg-card-white border-t border-[#E8E4F5] px-4 pt-2.5 pb-[34px]">
        <button
          onClick={() => router.push('/people/add')}
          className="w-full py-3.5 rounded-2xl bg-mooves-purple text-white font-display font-bold text-[15px] tracking-tight flex items-center justify-center gap-2"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
          Add friends
        </button>
      </div>

      {/* Remove confirmation sheet */}
      {removeTarget && (
        <>
          <div
            className="fixed inset-0 bg-text-primary/50 z-40"
            style={{ opacity: removeDrag.scrimOpacity }}
            onClick={handleCancelRemove}
            aria-hidden="true"
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-card-white rounded-t-3xl px-5 pt-4 [--safe-pb-base:2rem] safe-area-pb"
            role="dialog"
            aria-modal="true"
            {...removeDrag.sheetProps}
          >
            <SheetGrabber drag={removeDrag} className="mb-7" />
            <h2 className="font-display font-bold text-[18px] text-text-primary tracking-tight mb-2">
              Remove {removeTarget.displayName ?? 'friend'}?
            </h2>
            <p className="font-sans text-[14px] text-text-secondary leading-relaxed mb-6">
              They won&apos;t be able to see you on Mooves, and you won&apos;t see them.
            </p>
            <button
              onClick={() => void handleConfirmRemove()}
              className="w-full py-3.5 rounded-2xl bg-[#FFF0F2] text-[#E8405A] font-sans font-semibold text-[15px] mb-2"
            >
              Remove
            </button>
            <button
              onClick={handleCancelRemove}
              className="w-full py-3.5 rounded-2xl bg-surface-bg text-text-secondary font-sans font-semibold text-[15px]"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {toastMessage && (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      )}
    </div>
  )
}

function sortFriends(friends: Friend[]): Friend[] {
  return [...friends].sort((a, b) =>
    (a.displayName ?? '').localeCompare(b.displayName ?? '', undefined, { sensitivity: 'base' })
  )
}
