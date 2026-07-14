'use client'

// Screen 8 content, embedded under the People tab's Friends sub-tab.
// Search + friend list + swipe-to-remove + sticky invite button.
// The People header, sub-tabs, and bottom nav live in PeopleScreen.

import { useEffect, useMemo, useRef, useState } from 'react'
import { initPostHog, posthog } from '@/lib/posthog'
import CowIllustration from '@/components/ui/CowIllustration'
import Toast from '@/components/ui/Toast'
import FriendsList from './FriendsList'

interface Friend {
  id: string
  displayName: string | null
  avatarUrl: string | null
}

export default function FriendsPanel() {
  const [friends, setFriends] = useState<Friend[] | null>(null)
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [removeTarget, setRemoveTarget] = useState<Friend | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const searchFired = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function init() {
      initPostHog()
      posthog.capture('friends_list_viewed')

      const [friendsRes, me] = await Promise.all([
        fetch('/api/friends').then(r => r.json()) as Promise<{ friends: Friend[] }>,
        fetch('/api/users/me').then(r => r.json()) as Promise<{ referralCode?: string }>,
      ])
      if (cancelled) return

      setFriends(sortFriends(friendsRes.friends ?? []))
      setReferralCode(me.referralCode ?? null)
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

  async function handleInvite() {
    posthog.capture('friends_invite_tapped')
    if (!referralCode) return
    const shareUrl = `https://makemooves.app/join/${referralCode}`
    const canShare = typeof navigator !== 'undefined' && 'share' in navigator
    if (canShare) {
      try {
        await navigator.share({
          title: 'Join me on Mooves',
          text: 'See when your friends are free, without having to ask.',
          url: shareUrl,
        })
      } catch {
        // user dismissed the share sheet — no-op
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl)
        setToastMessage('Copied!')
      } catch {
        // silent
      }
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
              className={`w-full bg-surface-bg rounded-xl py-2.5 pl-9 pr-3.5 font-sans text-[14px] text-text-primary outline-none border-[1.5px] ${
                query.trim() ? 'border-mooves-purple' : 'border-[#E8E4F5]'
              }`}
            />
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 flex flex-col pb-[136px]">
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
            <FriendsList friends={filtered} query={query} onRemove={handleRemoveInitiated} />
          ))}
      </div>

      {/* Sticky invite button (above bottom nav) */}
      <div className="fixed bottom-[72px] left-0 right-0 z-30 bg-card-white border-t border-[#E8E4F5] px-4 py-2.5">
        <button
          onClick={() => void handleInvite()}
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
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          Invite friends
        </button>
      </div>

      {/* Remove confirmation sheet */}
      {removeTarget && (
        <>
          <div
            className="fixed inset-0 bg-text-primary/50 z-40"
            onClick={handleCancelRemove}
            aria-hidden="true"
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-card-white rounded-t-3xl px-5 pt-4 pb-8 safe-area-pb"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-9 h-1 rounded-full bg-[#E8E4F5] mx-auto mb-5" />
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
