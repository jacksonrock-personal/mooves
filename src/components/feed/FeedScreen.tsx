'use client'

// Screen 4: Home Feed
// Mockup: mooves-screen4-feed.html (status control per Amendment A)

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { initPostHog, posthog } from '@/lib/posthog'
import AvailRow from './AvailRow'
import FriendCard from './FriendCard'
import GoGreenSheet from '@/components/go-green/GoGreenSheet'
import GoGreyConfirm from '@/components/go-green/GoGreyConfirm'
import BottomNav from '@/components/ui/BottomNav'
import CowIllustration from '@/components/ui/CowIllustration'
import Toast from '@/components/ui/Toast'

interface Friend {
  id: string
  displayName: string
  avatarUrl: string | null
  statusNote: string | null
  phone: string
  statusSetAt: string | null
}

interface Group {
  id: string
  name: string
  emoji: string
}

export default function FeedScreen() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [friends, setFriends] = useState<Friend[] | null>(null)
  const [totalFriendCount, setTotalFriendCount] = useState<number | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [isAvailable, setIsAvailable] = useState(false)
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [greyOpen, setGreyOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const friendIdsRef = useRef<Set<string>>(new Set())
  const myGroupIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    let channel: RealtimeChannel | null = null

    // Screen 1/12: if arriving via an invite link, resolve the referral code
    // (sessionStorage first, URL param fallback) into a mutual friendship.
    async function resolveInvite() {
      const inviteCode =
        (typeof window !== 'undefined' ? sessionStorage.getItem('mooves_invite_code') : null) ||
        searchParams.get('invite')
      if (!inviteCode) return

      try {
        const res = await fetch('/api/friendships', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referral_code: inviteCode }),
        })

        if (res.status === 201) {
          const data = await res.json() as { display_name: string }
          posthog.capture('invite_friendship_created')
          setToastMessage(`${data.display_name} is now your Mooves friend! 🟢`)
        } else if (res.status === 409) {
          const data = await res.json() as { display_name: string }
          posthog.capture('invite_already_friends')
          setToastMessage(`You can already see ${data.display_name} on Mooves!`)
        }

        if (res.status === 201 || res.status === 409) {
          sessionStorage.removeItem('mooves_invite_code')
        }
      } catch {
        // network error — leave the code in place, harmless to retry on next visit
      }
    }

    async function init() {
      initPostHog()
      posthog.capture('feed_viewed')

      const me = await fetch('/api/users/me').then(r => r.json()) as {
        onboardingComplete?: boolean
        isAvailable?: boolean
        statusNote?: string | null
        referralCode?: string
      }
      if (cancelled) return
      if (me.onboardingComplete === false) {
        router.replace('/onboarding')
        return
      }
      setIsAvailable(!!me.isAvailable)
      setReferralCode(me.referralCode ?? null)

      await resolveInvite()
      if (cancelled) return

      const [friendsRes, feedRes, groupsRes] = await Promise.all([
        fetch('/api/friends').then(r => r.json()) as Promise<{ friends: { id: string }[] }>,
        fetch('/api/feed').then(r => r.json()) as Promise<{ friends: Friend[] }>,
        fetch('/api/groups').then(r => r.json()) as Promise<{ groups: Group[] }>,
      ])
      if (cancelled) return

      const friendIds = new Set(friendsRes.friends.map(f => f.id))
      friendIdsRef.current = friendIds
      setTotalFriendCount(friendIds.size)
      setFriends(feedRes.friends ?? [])
      setGroups(groupsRes.groups ?? [])

      const tokenRes = await fetch('/api/auth/supabase-token').then(r => r.json()) as {
        token: string | null
        userId?: string
      }
      if (cancelled || !tokenRes.token || !tokenRes.userId) return

      const supabase = createClient(tokenRes.token)

      const { data: memberOf } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', tokenRes.userId)
      myGroupIdsRef.current = new Set((memberOf ?? []).map(m => m.group_id))

      channel = supabase
        .channel('feed-updates')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'users' },
          payload => {
            const updated = payload.new as {
              id: string
              display_name: string | null
              avatar_url: string | null
              status_note: string | null
              phone: string
              is_available: boolean
              visible_to: string[] | null
              status_set_at: string | null
            }
            if (!friendIdsRef.current.has(updated.id)) return

            const visible = updated.is_available && (
              updated.visible_to === null ||
              updated.visible_to.some(gid => myGroupIdsRef.current.has(gid))
            )

            setFriends(prev => {
              const withoutUpdated = (prev ?? []).filter(f => f.id !== updated.id)
              if (!visible) return withoutUpdated
              const next: Friend = {
                id: updated.id,
                displayName: updated.display_name ?? '',
                avatarUrl: updated.avatar_url,
                statusNote: updated.status_note,
                phone: updated.phone,
                statusSetAt: updated.status_set_at,
              }
              return [...withoutUpdated, next].sort((a, b) =>
                (b.statusSetAt ?? '').localeCompare(a.statusSetAt ?? '')
              )
            })
          }
        )
        .subscribe()
    }

    void init()

    return () => {
      cancelled = true
      void channel?.unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleAvailRowTap() {
    posthog.capture('feed_status_toggle_tapped')
    posthog.capture('go_green_sheet_opened')
    setSheetOpen(true)
  }

  function handleFreeButtonTap() {
    posthog.capture('feed_status_toggle_tapped')
    posthog.capture('go_grey_sheet_opened')
    setGreyOpen(true)
  }

  function handleGoGreenNudge() {
    posthog.capture('feed_go_green_nudge_tapped')
    posthog.capture('go_green_sheet_opened')
    setSheetOpen(true)
  }

  async function handleConfirmGrey() {
    const res = await fetch('/api/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAvailable: false }),
    })
    if (res.ok) {
      setIsAvailable(false)
      posthog.capture('go_grey_confirmed')
    }
    setGreyOpen(false)
  }

  function handleCancelGrey() {
    posthog.capture('go_grey_cancelled')
    setGreyOpen(false)
  }

  async function handleInviteTap() {
    posthog.capture('feed_invite_tapped')
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
        // user dismissed share sheet — no-op
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl)
      } catch {
        // silent
      }
    }
  }

  const loaded = friends !== null && totalFriendCount !== null

  return (
    <div className="min-h-screen flex flex-col bg-surface-bg">
      <header className="bg-gradient-to-b from-mooves-purple via-[#9B7FE8] to-[#A98FF0] px-5 pt-14 pb-5 flex items-center justify-center shrink-0">
        <span className="flex items-center font-display font-extrabold text-[20px] text-white tracking-tight">
          M
          <span className="inline-flex items-center gap-[1px] relative top-[0.5px] mx-[1px]">
            <span className="w-[11px] h-[11px] rounded-full bg-status-green shadow-[0_0_6px_rgba(46,204,113,0.6)]" />
            <span className="w-[11px] h-[11px] rounded-full bg-white/35" />
          </span>
          VES
        </span>
      </header>

      <div className="flex-1 flex flex-col px-4 pt-4 pb-24">
        {loaded && (
          <>
            <AvailRow
              isAvailable={isAvailable}
              onToggle={isAvailable ? handleFreeButtonTap : handleAvailRowTap}
            />

            {totalFriendCount === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4 pb-8">
                <CowIllustration size={80} className="mb-5" />
                <p className="font-display font-extrabold text-[20px] text-text-primary tracking-tight leading-snug mb-2">
                  Your friends aren&apos;t<br />here yet.
                </p>
                <p className="font-sans text-[15px] text-text-secondary mb-7">
                  They should be.
                </p>
                <button
                  onClick={() => void handleInviteTap()}
                  className="w-full py-4 rounded-2xl bg-mooves-purple text-white font-display font-extrabold text-[16px] tracking-tight"
                >
                  Invite your friends
                </button>
              </div>
            ) : friends.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-8 pb-8">
                <p className="font-display font-extrabold text-[20px] text-text-primary tracking-tight mb-2">
                  Nobody&apos;s free yet.
                </p>
                <button
                  onClick={handleGoGreenNudge}
                  className="font-sans font-semibold text-[15px] text-mooves-purple"
                >
                  You could change that.
                </button>
              </div>
            ) : (
              <>
                <p className="font-sans text-[11px] font-semibold text-text-secondary uppercase tracking-[0.08em] px-1 pb-3">
                  Free right now
                </p>
                {friends.map(f => (
                  <FriendCard key={f.id} {...f} />
                ))}
              </>
            )}
          </>
        )}
      </div>

      <BottomNav />

      <GoGreenSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        groups={groups}
        onSuccess={() => {
          setIsAvailable(true)
          setSheetOpen(false)
          setToastMessage("You're free! 🎉")
        }}
      />
      <GoGreyConfirm
        open={greyOpen}
        onConfirm={() => void handleConfirmGrey()}
        onCancel={handleCancelGrey}
      />

      {toastMessage && (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      )}
    </div>
  )
}
