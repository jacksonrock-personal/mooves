'use client'

// Screen 4: Home Feed. Phase 9 deepens the core loop:
//  - swipe-to-go-green control (amendment A1) opens the go-green sheet
//  - "Your move" card with live joiners + group-chat blast at 2+ joins
//  - "I'm in" join toggle on friends' cards (9.2), realtime via move_joins
//  - post-blast "Plan's set?" prompt (9.4)

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { initPostHog, posthog } from '@/lib/posthog'
import { buildBlastHref } from '@/lib/blast'
import FriendCard from './FriendCard'
import MyMoveCard from './MyMoveCard'
import SwipeToGoGreen from './SwipeToGoGreen'
import AmbientTier from './AmbientTier'
import { type AnchoredMove } from './AnchoredMoveCard'
import GoGreenSheet from '@/components/go-green/GoGreenSheet'
import GoGreyConfirm from '@/components/go-green/GoGreyConfirm'
import Sheet from '@/components/ui/Sheet'
import BottomNav from '@/components/ui/BottomNav'
import CowIllustration from '@/components/ui/CowIllustration'
import Toast from '@/components/ui/Toast'
import Wordmark from '@/components/ui/Wordmark'

interface Joiner {
  id: string
  displayName: string | null
  avatarUrl: string | null
}
interface MyJoiner extends Joiner {
  phone: string
}
interface Friend {
  id: string
  displayName: string | null
  avatarUrl: string | null
  statusNote: string | null
  statusTime: string | null
  phone: string
  statusSetAt: string | null
  joiners: Joiner[]
  joinedByMe: boolean
  anchoredMove: AnchoredMove | null
}
interface Group {
  id: string
  name: string
  emoji: string
}
interface Me {
  id: string
  displayName: string | null
  avatarUrl: string | null
}

export default function FeedScreen() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [me, setMe] = useState<Me | null>(null)
  const [friends, setFriends] = useState<Friend[] | null>(null)
  const [totalFriendCount, setTotalFriendCount] = useState<number | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [isAvailable, setIsAvailable] = useState(false)
  const [myStatusNote, setMyStatusNote] = useState<string | null>(null)
  const [myStatusTime, setMyStatusTime] = useState<string | null>(null)
  const [myAnchoredMove, setMyAnchoredMove] = useState<AnchoredMove | null>(null)
  const [pendingAnchor, setPendingAnchor] = useState<AnchoredMove | null>(null)
  const [myJoiners, setMyJoiners] = useState<MyJoiner[]>([])
  const [ambient, setAmbient] = useState<{ activeNow: number; recentGreen: number }>({ activeNow: 0, recentGreen: 0 })
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [greyOpen, setGreyOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const meIdRef = useRef<string | null>(null)
  const friendIdsRef = useRef<Set<string>>(new Set())
  const mountedRef = useRef(true)
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refetchFeed = useCallback(async () => {
    const data = (await fetch('/api/feed').then(r => r.json())) as {
      friends: Friend[]
      myJoiners: MyJoiner[]
      ambient?: { activeNow: number; recentGreen: number }
    }
    if (!mountedRef.current) return
    setFriends(data.friends ?? [])
    setMyJoiners(data.myJoiners ?? [])
    if (data.ambient) setAmbient(data.ambient)
  }, [])

  const scheduleRefetch = useCallback(() => {
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current)
    refetchTimerRef.current = setTimeout(() => void refetchFeed(), 250)
  }, [refetchFeed])

  useEffect(() => {
    mountedRef.current = true
    let channel: RealtimeChannel | null = null

    // Presence heartbeat (10.1) — mark active on load + whenever the app foregrounds.
    function pingPresence() {
      void fetch('/api/presence', { method: 'POST' }).catch(() => {})
    }
    function handleVisibility() {
      if (document.visibilityState === 'visible') pingPresence()
    }
    pingPresence()
    document.addEventListener('visibilitychange', handleVisibility)

    // If arriving via an invite link, resolve the referral code into a friendship.
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
          const data = (await res.json()) as { display_name: string }
          posthog.capture('invite_friendship_created')
          setToastMessage(`${data.display_name} is now your Mooves friend! 🟢`)
        } else if (res.status === 409) {
          const data = (await res.json()) as { display_name: string }
          posthog.capture('invite_already_friends')
          setToastMessage(`You can already see ${data.display_name} on Mooves!`)
        }
        if (res.status === 201 || res.status === 409) {
          sessionStorage.removeItem('mooves_invite_code')
        }
      } catch {
        // network error — harmless to retry next visit
      }
    }

    // Phase 10.2: complete a group-invite join (adds to group + auto-friends all members).
    async function resolveGroupInvite() {
      const code =
        (typeof window !== 'undefined' ? sessionStorage.getItem('mooves_group_invite_code') : null) ||
        searchParams.get('ginvite')
      if (!code) return
      try {
        const res = await fetch(`/api/group-invite/${code}/join`, { method: 'POST' })
        if (res.ok) {
          const data = (await res.json()) as { status: string; name?: string; connectedCount?: number }
          if (data.status === 'joined') {
            posthog.capture('group_invite_join_completed', { connected: data.connectedCount })
            const n = data.connectedCount ?? 0
            setToastMessage(`You're in ${data.name}! Connected with ${n} ${n === 1 ? 'friend' : 'friends'}.`)
          } else if (data.status === 'already_member') {
            setToastMessage(`You're already in ${data.name}.`)
          }
        }
        if (res.ok || res.status === 404) {
          sessionStorage.removeItem('mooves_group_invite_code')
        }
      } catch {
        // network error — leave the code to retry next visit
      }
    }

    async function init() {
      initPostHog()
      posthog.capture('feed_viewed')

      const meData = (await fetch('/api/users/me').then(r => r.json())) as {
        id: string
        displayName: string | null
        avatarUrl: string | null
        onboardingComplete?: boolean
        isAvailable?: boolean
        statusNote?: string | null
        statusTime?: string | null
        anchoredMove?: AnchoredMove | null
        referralCode?: string
      }
      if (!mountedRef.current) return
      if (meData.onboardingComplete === false) {
        router.replace('/onboarding')
        return
      }
      meIdRef.current = meData.id
      setMe({ id: meData.id, displayName: meData.displayName, avatarUrl: meData.avatarUrl })
      setIsAvailable(!!meData.isAvailable)
      setMyStatusNote(meData.statusNote ?? null)
      setMyStatusTime(meData.statusTime ?? null)
      setMyAnchoredMove(meData.anchoredMove ?? null)
      setReferralCode(meData.referralCode ?? null)

      await resolveInvite()
      await resolveGroupInvite()
      if (!mountedRef.current) return

      const [friendsRes, feedRes, groupsRes] = await Promise.all([
        fetch('/api/friends').then(r => r.json()) as Promise<{ friends: { id: string }[] }>,
        fetch('/api/feed').then(r => r.json()) as Promise<{ friends: Friend[]; myJoiners: MyJoiner[]; ambient?: { activeNow: number; recentGreen: number } }>,
        fetch('/api/groups').then(r => r.json()) as Promise<{ groups: Group[] }>,
      ])
      if (!mountedRef.current) return

      friendIdsRef.current = new Set(friendsRes.friends.map(f => f.id))
      setTotalFriendCount(friendIdsRef.current.size)
      setFriends(feedRes.friends ?? [])
      setMyJoiners(feedRes.myJoiners ?? [])
      if (feedRes.ambient) setAmbient(feedRes.ambient)
      setGroups(groupsRes.groups ?? [])

      // Arriving from Discover "Go with friends" (13.8): pre-anchor the go-green sheet.
      const anchorId = searchParams.get('anchor')
      if (anchorId) {
        try {
          const move = (await fetch(`/api/discover/${anchorId}`).then(r =>
            r.ok ? r.json() : null,
          )) as AnchoredMove | null
          if (move && mountedRef.current) {
            setPendingAnchor(move)
            setSheetOpen(true)
            posthog.capture('go_green_sheet_opened', { anchored: true })
            // Strip ?anchor= so a refresh/remount doesn't reopen the sheet.
            if (typeof window !== 'undefined') window.history.replaceState({}, '', '/feed')
          }
        } catch {
          // ignore — bad/expired anchor just opens the normal flow
        }
      }

      const tokenRes = (await fetch('/api/auth/supabase-token').then(r => r.json())) as {
        token: string | null
        userId?: string
      }
      if (!mountedRef.current || !tokenRes.token) return

      const supabase = createClient(tokenRes.token)
      channel = supabase
        .channel('feed-updates')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'users' },
          payload => {
            const id = (payload.new as { id?: string }).id
            if (id && (id === meIdRef.current || friendIdsRef.current.has(id))) scheduleRefetch()
          },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'move_joins' },
          payload => {
            const row = (payload.new ?? payload.old) as { mover_id?: string }
            const mover = row?.mover_id
            if (mover && (mover === meIdRef.current || friendIdsRef.current.has(mover))) scheduleRefetch()
          },
        )
        .subscribe()
    }

    void init()

    return () => {
      mountedRef.current = false
      document.removeEventListener('visibilitychange', handleVisibility)
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current)
      void channel?.unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSwipeActivate() {
    posthog.capture('go_green_sheet_opened')
    setSheetOpen(true)
  }

  function handleGoGreenSuccess(move: { statusNote: string | null; statusTime: string | null }) {
    setIsAvailable(true)
    setMyStatusNote(move.statusNote)
    setMyStatusTime(move.statusTime)
    setMyAnchoredMove(pendingAnchor) // null for a normal go-green
    setPendingAnchor(null)
    setMyJoiners([])
    setSheetOpen(false)
    setToastMessage("You're free! 🎉")
    void refetchFeed()
  }

  function handleToggleJoin(moverId: string, joined: boolean) {
    const wantJoin = !joined
    const meNow = me
    // Optimistic update; realtime refetch reconciles authoritative joiners.
    setFriends(prev =>
      (prev ?? []).map(f => {
        if (f.id !== moverId) return f
        const without = f.joiners.filter(j => j.id !== meNow?.id)
        const joiners =
          wantJoin && meNow
            ? [...without, { id: meNow.id, displayName: meNow.displayName, avatarUrl: meNow.avatarUrl }]
            : without
        return { ...f, joinedByMe: wantJoin, joiners }
      }),
    )
    fetch('/api/moves/join', {
      method: wantJoin ? 'POST' : 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moverId }),
    })
      .then(res => {
        if (!res.ok) throw new Error('join failed')
      })
      .catch(() => {
        setToastMessage("Couldn't update, try again.")
        void refetchFeed()
      })
  }

  function handleBlast() {
    const phones = myJoiners.map(j => j.phone).filter(Boolean)
    if (phones.length === 0) return
    posthog.capture('blast_started')
    window.location.href = buildBlastHref(phones)
    setPlanOpen(true)
  }

  async function handleConfirmGrey() {
    const res = await fetch('/api/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAvailable: false }),
    })
    if (res.ok) {
      setIsAvailable(false)
      setMyStatusNote(null)
      setMyStatusTime(null)
      setMyAnchoredMove(null)
      setMyJoiners([])
      posthog.capture('go_grey_confirmed')
    }
    setGreyOpen(false)
    setPlanOpen(false)
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

  const loaded = friends !== null && totalFriendCount !== null && me !== null

  return (
    <div className="min-h-screen flex flex-col bg-purple-50">
      <header className="bg-gradient-to-b from-purple-500 via-[#9B7FE8] to-[#A98FF0] px-5 pt-7 pb-6 flex items-center justify-center shrink-0">
        <Wordmark variant="light" withCow />
      </header>

      <div className="flex-1 flex flex-col px-4 pt-4 pb-24">
        {loaded && me && (
          <>
            {isAvailable ? (
              <MyMoveCard
                statusNote={myStatusNote}
                statusTime={myStatusTime}
                anchoredMove={myAnchoredMove}
                joiners={myJoiners}
                meId={me.id}
                onBlast={handleBlast}
                onGoGrey={() => setGreyOpen(true)}
              />
            ) : (
              <SwipeToGoGreen onActivate={handleSwipeActivate} />
            )}

            {totalFriendCount === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4 pb-8">
                <CowIllustration size={80} className="mb-5" />
                <p className="font-display font-extrabold text-[20px] text-ink-900 tracking-tight leading-snug mb-2">
                  Your friends aren&apos;t<br />here yet.
                </p>
                <p className="font-sans text-[15px] text-ink-500 mb-7">They should be.</p>
                <button
                  onClick={() => void handleInviteTap()}
                  className="w-full py-4 rounded-2xl bg-purple-500 text-white font-display font-extrabold text-[16px] tracking-tight"
                >
                  Invite your friends
                </button>
              </div>
            ) : friends.length === 0 ? (
              <AmbientTier activeNow={ambient.activeNow} recentGreen={ambient.recentGreen} />
            ) : (
              <>
                <p className="font-sans text-[11px] font-semibold text-ink-500 uppercase tracking-[0.08em] px-1 pb-3">
                  Free right now
                </p>
                {friends.map(f => (
                  <FriendCard
                    key={f.id}
                    id={f.id}
                    displayName={f.displayName}
                    avatarUrl={f.avatarUrl}
                    statusNote={f.statusNote}
                    statusTime={f.statusTime}
                    anchoredMove={f.anchoredMove}
                    phone={f.phone}
                    joiners={f.joiners}
                    joinedByMe={f.joinedByMe}
                    meId={me.id}
                    onToggleJoin={handleToggleJoin}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>

      <BottomNav />

      <GoGreenSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
          setPendingAnchor(null)
        }}
        groups={groups}
        anchoredMove={pendingAnchor}
        onSuccess={handleGoGreenSuccess}
      />
      <GoGreyConfirm
        open={greyOpen}
        onConfirm={() => void handleConfirmGrey()}
        onCancel={() => setGreyOpen(false)}
      />

      <Sheet open={planOpen} onClose={() => setPlanOpen(false)} className="px-5 pb-8">
        <div className="text-center">
          <div className="text-[30px] leading-none mb-2.5">🎉</div>
          <h2 className="font-display font-extrabold text-[19px] text-ink-900 tracking-tight mb-1.5">
            Plan&apos;s set?
          </h2>
          <p className="font-sans text-[14px] text-ink-500 leading-relaxed mb-5">
            Go grey now, or keep green so more friends can jump in.
          </p>
        </div>
        <button
          onClick={() => setPlanOpen(false)}
          className="w-full py-3.5 rounded-[14px] bg-green-500/[0.09] text-green-700 border-[1.5px] border-green-500/25 font-sans font-bold text-[15px] mb-2"
        >
          Keep green for more
        </button>
        <button
          onClick={() => void handleConfirmGrey()}
          className="w-full py-3.5 rounded-[14px] bg-purple-50 text-ink-500 font-sans font-bold text-[15px]"
        >
          Go grey
        </button>
      </Sheet>

      {toastMessage && (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      )}
    </div>
  )
}
