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
import { buildBlastHref, type WaveTime } from '@/lib/blast'
import { isGreenExpired } from '@/lib/greenExpiry'
import { markValueMoment } from '@/lib/pwa'
import MyMoveCard from './MyMoveCard'
import SwipeToGoGreen from './SwipeToGoGreen'
import WaveStrip from './WaveStrip'
import TipJar from './TipJar'
import AmbientTier from './AmbientTier'
import RoundupJoinedSheet from './RoundupJoinedSheet'
import GreenRail, { sortRail, type RailPerson } from './GreenRail'
import PlanCard from './PlanCard'
import PlanComposer, { type PlanPrefill } from './PlanComposer'
import MooveActionsSheet from './MooveActionsSheet'
import FreeUntilSheet from './FreeUntilSheet'
import type { Plan } from '@/lib/plans'
import { type AnchoredMove } from './AnchoredMoveCard'
import GoGreenSheet from '@/components/go-green/GoGreenSheet'
import GoGreyConfirm from '@/components/go-green/GoGreyConfirm'
import WeekRitualSheet from '@/components/availability/WeekRitualSheet'
import ConfirmFreeSheet from '@/components/availability/ConfirmFreeSheet'
import { syncTimezone } from '@/lib/timezone'
import { isSlotPart, toLocalDateStr, weekDates, type SlotPart } from '@/lib/availability'
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
  /** 18.2 — already intersected with this viewer's groups by get_feed. */
  visibleGroups?: string[]
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
// 17.1 (refined 0008) — the resolved wave group from get_feed: a connected set of
// same-time green friends. null when no wave qualifies. friendIds ⊆ feed friends.
interface Wave {
  timeBucket: WaveTime
  friendIds: string[]
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
  // 18.2 — your own green's group scope. Names resolve client-side against the
  // groups list already loaded, so this needs no extra round trip.
  const [myVisibleGroupIds, setMyVisibleGroupIds] = useState<string[]>([])
  const [myShowGroups, setMyShowGroups] = useState(false)
  const [myAnchoredMove, setMyAnchoredMove] = useState<AnchoredMove | null>(null)
  const [pendingAnchor, setPendingAnchor] = useState<AnchoredMove | null>(null)
  const [myJoiners, setMyJoiners] = useState<MyJoiner[]>([])
  const [ambient, setAmbient] = useState<{ activeNow: number; recentGreen: number }>({ activeNow: 0, recentGreen: 0 })
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [greyOpen, setGreyOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [joinedPromptOpen, setJoinedPromptOpen] = useState(false) // 9.5 Part B
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  // 19.1 — set after an "add everyone here" join completes. Drives the one and
  // only surface where Undo is offered; clearing it retires Undo for good.
  const [roundupJoin, setRoundupJoin] = useState<{ code: string; connectedCount: number } | null>(
    null,
  )
  // ── Phase 20 ──────────────────────────────────────────────────────────────
  // Rail is people, feed is Mooves. `railSelected` is which green's card shows
  // under the rail; it defaults to the most recent one so the feed still opens
  // with a note and an "I'm in" visible, exactly as it did before the rail.
  const [plans, setPlans] = useState<Plan[]>([])
  const [railSelected, setRailSelected] = useState<string | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [actionsPlan, setActionsPlan] = useState<Plan | null>(null)
  const [planPrefill, setPlanPrefill] = useState<PlanPrefill | null>(null)
  const [freeUntilOpen, setFreeUntilOpen] = useState(false)
  const [myStatusExpiresAt, setMyStatusExpiresAt] = useState<string | null>(null)
  // 17.1 in-app wave strip. `wave` is the resolved group from the feed; dismissal
  // persists across app opens keyed by the wave's signature (its members + time), so
  // a dismissed wave stays gone while that same group is green, but a genuinely new
  // wave can still surface. (0008 amendment.)
  // ── Phase 22 ──────────────────────────────────────────────────────────────
  // The ritual launches on ARRIVAL on your chosen day, which is what keeps it
  // clear of 17.3: it meets you in a session you already started rather than
  // asking for one. The confirm sheet opens ONLY from the 9am push (?confirm=1)
  // — never on a later arrival, because "an unconfirmed slot does nothing,
  // ever" would not survive an in-app card waiting for you afterwards.
  const [ritualOpen, setRitualOpen] = useState(false)
  const [ritualSource, setRitualSource] = useState<'arrival' | 'push' | 'settings'>('arrival')
  const [ritualDay, setRitualDay] = useState(1)
  const [confirmParts, setConfirmParts] = useState<SlotPart[] | null>(null)
  const [wave, setWave] = useState<Wave | null>(null)
  const [dismissedWaveSigs, setDismissedWaveSigs] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = JSON.parse(localStorage.getItem('mooves.dismissedWaves') ?? '[]')
      return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === 'string') : []
    } catch {
      return []
    }
  })

  const meIdRef = useRef<string | null>(null)
  const friendIdsRef = useRef<Set<string>>(new Set())
  const mountedRef = useRef(true)
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refetchFeed = useCallback(async () => {
    const data = (await fetch('/api/feed').then(r => r.json())) as {
      friends: Friend[]
      myJoiners: MyJoiner[]
      ambient?: { activeNow: number; recentGreen: number }
      wave?: Wave | null
    }
    if (!mountedRef.current) return
    setFriends(data.friends ?? [])
    setMyJoiners(data.myJoiners ?? [])
    if (data.ambient) setAmbient(data.ambient)
    setWave(data.wave ?? null)
  }, [])

  // A wave's identity = its time bucket + its members (order-independent). Dismissing
  // stores this; the same group re-forming stays hidden, a different group can appear.
  const waveSignature = useCallback(
    (w: Wave) => `${w.timeBucket}|${[...w.friendIds].sort().join(',')}`,
    [],
  )

  const dismissWave = useCallback(() => {
    if (!wave) return
    const sig = waveSignature(wave)
    setDismissedWaveSigs(prev => {
      const next = [sig, ...prev.filter(s => s !== sig)].slice(0, 30) // cap; drop oldest
      try {
        localStorage.setItem('mooves.dismissedWaves', JSON.stringify(next))
      } catch {
        // storage unavailable (private mode) — dismissal falls back to this session
      }
      return next
    })
  }, [wave, waveSignature])

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

    // Phase 19.1: complete an "add everyone here" join. Unlike the group invite
    // above, this ends in a SHEET rather than a toast, because it is the only
    // place Undo is ever offered — scanning the wrong code otherwise costs up to
    // 25 separate unfriends.
    async function resolveRoundup() {
      const code =
        (typeof window !== 'undefined' ? sessionStorage.getItem('mooves_roundup_code') : null) ||
        searchParams.get('rinvite')
      if (!code) return
      try {
        const res = await fetch(`/api/roundup-invite/${code}/join`, { method: 'POST' })
        if (res.ok) {
          const data = (await res.json()) as {
            status: string
            memberCount?: number
            connectedCount?: number
          }
          if (data.status === 'joined') {
            posthog.capture('roundup_joined', { connected: data.connectedCount })
            setRoundupJoin({ code, connectedCount: data.connectedCount ?? 0 })
          } else if (data.status === 'already') {
            setToastMessage("You're already in.")
          } else if (data.status === 'full') {
            setToastMessage('That one is full.')
          } else if (data.status === 'expired' || data.status === 'invalid') {
            setToastMessage("That link isn't active anymore.")
          }
        }
        if (res.ok || res.status === 404) {
          sessionStorage.removeItem('mooves_roundup_code')
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
        statusSetAt?: string | null
        statusExpiresAt?: string | null
        visibleTo?: string[] | null
        statusShowGroups?: boolean
        anchoredMove?: AnchoredMove | null
        referralCode?: string
        timezone?: string | null
        weekRitualDay?: number
      }
      if (!mountedRef.current) return
      if (meData.onboardingComplete === false) {
        router.replace('/onboarding')
        return
      }
      meIdRef.current = meData.id
      setMe({ id: meData.id, displayName: meData.displayName, avatarUrl: meData.avatarUrl })

      // 9.5 Part A — the green expired while we were away: reconcile it to a real
      // grey (clears joins/chip/note/anchor server-side), silently. No toast.
      const greenExpired = !!meData.isAvailable && isGreenExpired(meData.statusExpiresAt ?? null)
      if (greenExpired) {
        posthog.capture('green_expired_reconciled')
        try {
          await fetch('/api/status', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isAvailable: false }),
          })
        } catch {
          // best-effort — the feed already hides expired greens server-side
        }
      }
      setIsAvailable(!!meData.isAvailable && !greenExpired)
      setMyStatusNote(greenExpired ? null : meData.statusNote ?? null)
      setMyStatusTime(greenExpired ? null : meData.statusTime ?? null)
      setMyAnchoredMove(greenExpired ? null : meData.anchoredMove ?? null)
      setMyVisibleGroupIds(greenExpired ? [] : meData.visibleTo ?? [])
      setMyShowGroups(greenExpired ? false : meData.statusShowGroups === true)
      setReferralCode(meData.referralCode ?? null)

      await resolveInvite()
      await resolveGroupInvite()
      await resolveRoundup()
      if (!mountedRef.current) return

      const [friendsRes, feedRes, groupsRes, plansRes] = await Promise.all([
        fetch('/api/friends').then(r => r.json()) as Promise<{ friends: { id: string }[] }>,
        fetch('/api/feed').then(r => r.json()) as Promise<{ friends: Friend[]; myJoiners: MyJoiner[]; ambient?: { activeNow: number; recentGreen: number }; wave?: Wave | null }>,
        fetch('/api/groups').then(r => r.json()) as Promise<{ groups: Group[] }>,
        // Phase 20 — Mooves are their own query. get_plans is a separate RPC on
        // purpose: get_feed has been broken twice by redefinition already.
        fetch('/api/plans').then(r => r.json()) as Promise<{ plans?: Plan[] }>,
      ])
      if (!mountedRef.current) return
      setPlans(plansRes.plans ?? [])
      setMyStatusExpiresAt(greenExpired ? null : meData.statusExpiresAt ?? null)

      friendIdsRef.current = new Set(friendsRes.friends.map(f => f.id))
      setTotalFriendCount(friendIdsRef.current.size)
      setFriends(feedRes.friends ?? [])
      setMyJoiners(greenExpired ? [] : feedRes.myJoiners ?? [])
      if (feedRes.ambient) setAmbient(feedRes.ambient)
      setWave(feedRes.wave ?? null)
      setGroups(groupsRes.groups ?? [])

      // 9.5 Part B — returning-mover prompt: fresh open, green still live, set
      // over an hour ago, 1+ joiner, and not yet shown for this green. Marked on
      // show so it appears at most once per green session.
      if (!greenExpired && meData.isAvailable && meData.statusSetAt) {
        const oldEnough = Date.now() - new Date(meData.statusSetAt).getTime() > 60 * 60 * 1000
        const hasJoiner = (feedRes.myJoiners ?? []).length >= 1
        const alreadyShown =
          typeof window !== 'undefined' &&
          localStorage.getItem('mooves_grey_prompted_for') === meData.statusSetAt
        if (oldEnough && hasJoiner && !alreadyShown) {
          localStorage.setItem('mooves_grey_prompted_for', meData.statusSetAt)
          setJoinedPromptOpen(true)
          posthog.capture('returning_prompt_shown')
        }
      }

      // Arriving from Discover "Go with friends" (13.8).
      //
      // This used to pre-anchor the GO-GREEN sheet, which was wrong: a sponsored
      // move has a date, a time and a place, and "I'm free right now" cannot
      // carry any of them. Bringing one to your friends is a MOOVE. So it now
      // opens the composer prefilled, and the sponsored id rides along so the
      // friend-facing disclosure survives the hand-off.
      const anchorId = searchParams.get('anchor')
      if (anchorId) {
        try {
          const move = (await fetch(`/api/discover/${anchorId}`).then(r =>
            r.ok ? r.json() : null,
          )) as (AnchoredMove & { startAt?: string | null; locationText?: string | null }) | null
          if (move && mountedRef.current) {
            setPlanPrefill({
              sponsoredMoveId: move.id,
              title: move.title,
              startAt: move.startAt ?? null,
              locationText: move.locationText ?? null,
              note: move.description ?? null,
            })
            setComposerOpen(true)
            posthog.capture('plan_composer_opened', { source: 'discover' })
            // Strip ?anchor= so a refresh/remount doesn't reopen the sheet.
            if (typeof window !== 'undefined') window.history.replaceState({}, '', '/feed')
          }
        } catch {
          // ignore — bad/expired anchor just leaves the feed as it was
        }
      }

      // ── Phase 22 — timezone capture and the ritual trigger ────────────────
      //
      // The zone is captured silently here, on app open. It is the only reason
      // this app stores one: a 9am-local job cannot run on a sleeping client.
      // Nothing on this screen computes from it — every local time on the
      // client is still computed on the client's own clock, as it always was.
      void syncTimezone(meData.timezone ?? null)

      const myRitualDay = meData.weekRitualDay ?? 1
      setRitualDay(myRitualDay)

      try {
        const days = weekDates(myRitualDay)
        const weekStart = toLocalDateStr(days[0])
        const weekEnd = toLocalDateStr(days[6])
        const todayStr = toLocalDateStr(new Date())

        const av = (await fetch(`/api/availability?from=${weekStart}&to=${weekEnd}`).then(r =>
          r.json(),
        )) as { slots?: { date: string; part: string }[] }
        if (!mountedRef.current) return
        const slots = av.slots ?? []

        // The push landing (?week=1) always opens it, whatever day it is.
        if (searchParams.get('week') === '1') {
          setRitualSource('push')
          setRitualOpen(true)
          if (typeof window !== 'undefined') window.history.replaceState({}, '', '/feed')
        } else {
          // Arrival: your ritual day, or the day after if you missed it. Two
          // arrivals and then it stops — it does not follow you through the
          // week. Dismissal is per-device and expires on its own at the next
          // ritual day, which is why it lives in localStorage rather than a
          // column: it is a dismissed sheet, not data anyone needs.
          const dayIndex = days.findIndex(d => toLocalDateStr(d) === todayStr)
          const dismissed =
            typeof window !== 'undefined' &&
            localStorage.getItem('mooves.weekRitualDismissed') === weekStart
          if (dayIndex >= 0 && dayIndex <= 1 && !dismissed && slots.length === 0) {
            setRitualSource('arrival')
            setRitualOpen(true)
          }
        }

        // The confirm, reached only from its own push.
        if (searchParams.get('confirm') === '1') {
          const todays = slots
            .filter(s => s.date === todayStr)
            .map(s => s.part)
            .filter(isSlotPart)
          if (todays.length > 0 && !meData.isAvailable) setConfirmParts([...new Set(todays)])
          if (typeof window !== 'undefined') window.history.replaceState({}, '', '/feed')
        }
      } catch {
        // The ritual is additive: if this fails the feed is exactly as it was.
      }

      // Arriving from the onboarding launchpad "Go green" (Screen 3 loop):
      // open the go-green sheet once, unless the user is already available.
      if (searchParams.get('gogreen') === '1') {
        if (!meData.isAvailable) {
          setSheetOpen(true)
          posthog.capture('go_green_sheet_opened', { source: 'launchpad' })
        }
        if (typeof window !== 'undefined') window.history.replaceState({}, '', '/feed')
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

  function handleGoGreenSuccess(move: {
    statusNote: string | null
    statusTime: string | null
    visibleGroupIds: string[]
    showGroups: boolean
  }) {
    setIsAvailable(true)
    setMyStatusNote(move.statusNote)
    setMyStatusTime(move.statusTime)
    // 18.2 — the sheet reports its own selection; /api/users/me isn't refetched here.
    setMyVisibleGroupIds(move.visibleGroupIds)
    setMyShowGroups(move.showGroups)
    setMyAnchoredMove(pendingAnchor) // null for a normal go-green
    setPendingAnchor(null)
    setMyJoiners([])
    setSheetOpen(false)
    setToastMessage("You're free! 🎉")
    void refetchFeed()
  }

  // Green joins are retired. A green is availability, so the response to one is
  // a text, not a commitment — tapping a face in the rail goes straight to
  // Messages. "I'm in", rosters and the 2+ group blast now live only on Mooves,
  // which are the object you can actually commit to. The 20.5 join-while-green
  // prompt went with them: there is no longer a join that could conflict.
  //
  // Left deliberately in place: get_feed still returns `joiners`/`joinedByMe`
  // for greens and move_joins still allows plan_id NULL rows. Both are inert.
  // Rewriting get_feed to drop them would be a sixth redefinition of a function
  // that has been silently broken twice, for no user-visible gain.

  // Phase 20 — joining a Moove. Same shape as a green join; the API keeps the
  // two apart via plan_id so neither leaks into the other.
  function handleTogglePlanJoin(planId: string, joined: boolean) {
    const wantJoin = !joined
    if (wantJoin) markValueMoment()
    const meNow = me
    setPlans(prev =>
      prev.map(p => {
        if (p.id !== planId) return p
        const without = p.joiners.filter(j => j.id !== meNow?.id)
        const joiners =
          wantJoin && meNow
            ? [...without, { id: meNow.id, displayName: meNow.displayName, avatarUrl: meNow.avatarUrl, phone: null }]
            : without
        return { ...p, joinedByMe: wantJoin, joiners }
      }),
    )
    fetch(`/api/plans/${planId}/join`, { method: wantJoin ? 'POST' : 'DELETE' })
      .then(res => {
        if (!res.ok) throw new Error('plan join failed')
      })
      .catch(() => {
        setToastMessage("Couldn't update, try again.")
        void refetchPlans()
      })
  }

  async function refetchPlans() {
    try {
      const res = (await fetch('/api/plans').then(r => r.json())) as { plans?: Plan[] }
      if (mountedRef.current) setPlans(res.plans ?? [])
    } catch {
      // transient
    }
  }

  /** Same 2+ gate as a green: never blast into silence. */
  function handlePlanBlast(plan: Plan) {
    const phones = plan.joiners.map(j => j.phone).filter((p): p is string => !!p)
    if (phones.length === 0) return
    markValueMoment()
    posthog.capture('plan_blast_started', { joiners: plan.joiners.length })
    window.location.href = buildBlastHref(phones)
  }

  /** 20.7 — moves the deadline only; the time bucket is untouched. */
  async function handleSetFreeUntil(iso: string) {
    setFreeUntilOpen(false)
    setMyStatusExpiresAt(iso)
    try {
      await fetch('/api/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isAvailable: true,
          statusNote: myStatusNote,
          statusTime: myStatusTime,
          visibleTo: myVisibleGroupIds.length > 0 ? myVisibleGroupIds : null,
          statusShowGroups: myShowGroups,
          statusExpiresAt: iso,
        }),
      })
    } catch {
      setToastMessage("Couldn't update, try again.")
    }
  }

  function handleBlast() {
    const phones = myJoiners.map(j => j.phone).filter(Boolean)
    if (phones.length === 0) return
    markValueMoment() // Phase 15.4: starting a group text is a value moment → may nudge to install
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
      setMyVisibleGroupIds([])
      setMyShowGroups(false)
      setMyJoiners([])
      posthog.capture('go_grey_confirmed')
    }
    setGreyOpen(false)
    setPlanOpen(false)
    setJoinedPromptOpen(false)
  }

  // 9.5 Part B — sheet heading from the real joiner names.
  function joinedHeading(): string {
    const names = myJoiners.map(j => j.displayName ?? 'A friend')
    if (names.length === 1) return `${names[0]} is in`
    if (names.length === 2) return `${names[0]} and ${names[1]} are in`
    return `${names[0]}, ${names[1]} and ${names.length - 2} more are in`
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

  // ── Phase 20 rail derivation ───────────────────────────────────────────────
  // Every green goes in the rail, you first. The feed below is Mooves only.
  const railPeople: RailPerson[] = [
    ...(isAvailable && me
      ? [{ id: me.id, displayName: me.displayName, avatarUrl: me.avatarUrl, statusTime: myStatusTime, isMe: true }]
      : []),
    ...(friends ?? []).map(f => ({
      id: f.id,
      displayName: f.displayName,
      avatarUrl: f.avatarUrl,
      statusTime: f.statusTime ?? null,
      isMe: false,
    })),
  ]

  // Default to the first rail entry so the feed still opens showing a note and
  // an "I'm in" — a rail of bare avatars with nothing expanded would have hidden
  // every note behind a tap, which is the regression the rail must not cause.
  const sorted = sortRail(railPeople)
  const effectiveRailSelection =
    railSelected && railPeople.some(p => p.id === railSelected)
      ? railSelected
      : (sorted[0]?.id ?? null)

  const selectedFriend =
    effectiveRailSelection && effectiveRailSelection !== me?.id
      ? (friends ?? []).find(f => f.id === effectiveRailSelection) ?? null
      : null

  return (
    <div className="min-h-screen flex flex-col bg-purple-50">
      <header className="bg-gradient-to-b from-purple-500 via-[#9B7FE8] to-[#A98FF0] px-5 pt-7 pb-6 flex items-center justify-center shrink-0">
        <Wordmark variant="light" withCow />
      </header>

      <div className="flex-1 flex flex-col px-4 pt-4 pb-24">
        {loaded && me && (
          <>
            {/* 17.1 (refined 0008) — green wave: a connected group of 3+ green friends
                sharing a time window, resolved server-side. Names not counts; dismissal
                persists per wave signature. */}
            {(() => {
              if (!wave) return null
              if (dismissedWaveSigs.includes(waveSignature(wave))) return null
              const waveFriends = wave.friendIds
                .map(id => friends.find(f => f.id === id))
                .filter((f): f is Friend => f !== undefined)
              if (waveFriends.length < 3) return null // stale membership vs. feed; skip
              return (
                <WaveStrip
                  friends={waveFriends.map(f => ({
                    id: f.id,
                    displayName: f.displayName,
                    avatarUrl: f.avatarUrl,
                    phone: f.phone,
                  }))}
                  timeBucket={wave.timeBucket}
                  onDismiss={dismissWave}
                />
              )
            })()}
            {/* 20.2 — the rail sits ABOVE the swipe: who is free comes first,
                then your own action, then everything later. */}
            <GreenRail
              people={railPeople}
              selectedId={effectiveRailSelection}
              onSelect={id => setRailSelected(id)}
              onText={id => {
                const f = (friends ?? []).find(x => x.id === id)
                if (!f?.phone) return
                posthog.capture('rail_tap_sms_opened')
                window.location.href = `sms:${f.phone}`
              }}
            />

            {isAvailable ? (
              // Your own green is the expanded state of your rail avatar, so the
              // card only renders when you are the one selected.
              effectiveRailSelection === me.id && (
                <MyMoveCard
                  statusNote={myStatusNote}
                  statusTime={myStatusTime}
                  visibleGroups={
                    myShowGroups
                      ? groups.filter(g => myVisibleGroupIds.includes(g.id)).map(g => g.name)
                      : []
                  }
                  anchoredMove={myAnchoredMove}
                  joiners={myJoiners}
                  meId={me.id}
                  statusExpiresAt={myStatusExpiresAt}
                  onEditExpiry={() => setFreeUntilOpen(true)}
                  onBlast={handleBlast}
                  onGoGrey={() => setGreyOpen(true)}
                />
              )
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
            ) : friends.length === 0 && plans.length === 0 ? (
              // 20.4 — the ambient tier only when BOTH surfaces are empty.
              <AmbientTier activeNow={ambient.activeNow} recentGreen={ambient.recentGreen} />
            ) : (
              <>
                {/* Green cards for friends are gone: a friend's face in the rail
                    goes straight to Messages. Greens carry availability,
                    Mooves carry commitment — so "I'm in", rosters and the group
                    blast now live only on Mooves. */}
                {plans.length > 0 && (
                  <>
                    <p className="font-sans text-[10.5px] font-bold text-ink-500 uppercase tracking-[0.1em] px-0.5 pt-1 pb-2.5">
                      Mooves
                    </p>
                    {plans.map(p => (
                      <PlanCard
                        key={p.id}
                        plan={p}
                        meId={me.id}
                        onToggleJoin={handleTogglePlanJoin}
                        onBlast={handlePlanBlast}
                        onActions={setActionsPlan}
                      />
                    ))}
                  </>
                )}

                {/* Phase 14.1: tip jar at the very bottom, only when 3+ moves are
                    live (greens + Mooves + your own green). Self-hides below 3. */}
                <TipJar visible={friends.length + plans.length + (isAvailable ? 1 : 0) >= 3} />
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

      {/* 9.5 Part B — returning-mover prompt: same action-sheet pattern as 9.4.
          Overlay-dismiss counts as "keep green" (dismiss only, expiry unchanged). */}
      <Sheet
        open={joinedPromptOpen}
        onClose={() => {
          setJoinedPromptOpen(false)
          posthog.capture('returning_prompt_kept')
        }}
        className="px-5 pb-8"
      >
        <div className="text-center">
          <div className="flex justify-center mb-3">
            <CowIllustration size={56} />
          </div>
          <h2 className="font-display font-extrabold text-[19px] text-ink-900 tracking-tight mb-1.5">
            {joinedHeading()}
          </h2>
          <p className="font-sans text-[14px] text-ink-500 leading-relaxed mb-5">
            Sounds like something came together. Go grey to wrap up this move, or keep it open for
            more.
          </p>
        </div>
        <button
          onClick={() => {
            posthog.capture('returning_prompt_grey')
            void handleConfirmGrey()
          }}
          className="w-full py-4 rounded-full bg-purple-500 text-white font-sans font-bold text-[15px]"
        >
          Go grey
        </button>
        <button
          onClick={() => {
            setJoinedPromptOpen(false)
            posthog.capture('returning_prompt_kept')
          }}
          className="w-full py-3 mt-1 text-ink-500 font-sans font-semibold text-[14px]"
        >
          Keep me green
        </button>
      </Sheet>

      {/* 20.3 — the plan path. A floating control, deliberately far from the
          swipe so the two creation gestures are never confused. */}
      {loaded && (
        <button
          onClick={() => {
            setEditingPlan(null)
            setComposerOpen(true)
          }}
          aria-label="Plan a Moove"
          className="fixed right-[15px] bottom-[74px] z-30 w-[58px] h-[58px] rounded-full bg-purple-500 border-[2.5px] border-purple-50 shadow-[0_8px_22px_rgba(124,92,219,0.5)] flex items-center justify-center"
        >
          <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}

      <PlanComposer
        open={composerOpen}
        onClose={() => {
          setComposerOpen(false)
          setEditingPlan(null)
          setPlanPrefill(null)
        }}
        groups={groups}
        editing={editingPlan}
        prefill={planPrefill}
        onSaved={() => {
          setToastMessage(editingPlan ? 'Moove updated.' : 'Moove posted.')
          void refetchPlans()
        }}
      />

      {actionsPlan && (
        <MooveActionsSheet
          plan={actionsPlan}
          onEdit={() => {
            setEditingPlan(actionsPlan)
            setActionsPlan(null)
            setComposerOpen(true)
          }}
          onCancelled={() => {
            setActionsPlan(null)
            setToastMessage('Moove cancelled.')
            void refetchPlans()
          }}
          onClose={() => setActionsPlan(null)}
        />
      )}

      {freeUntilOpen && (
        <FreeUntilSheet
          currentExpiresAt={myStatusExpiresAt}
          onPick={iso => void handleSetFreeUntil(iso)}
          onClose={() => setFreeUntilOpen(false)}
        />
      )}


      {/* 19.1 — post-join confirmation. Undo lives here and nowhere else. */}
      {roundupJoin && (
        <RoundupJoinedSheet
          code={roundupJoin.code}
          connectedCount={roundupJoin.connectedCount}
          onDismiss={() => setRoundupJoin(null)}
          onUndone={removed => {
            setRoundupJoin(null)
            setToastMessage(
              removed === 0
                ? 'Undone.'
                : `Removed ${removed} ${removed === 1 ? 'person' : 'people'}.`,
            )
            scheduleRefetch()
          }}
        />
      )}

      {/* 22.3 — the weekly ritual. */}
      <WeekRitualSheet
        open={ritualOpen}
        ritualDay={ritualDay}
        source={ritualSource}
        onClose={() => setRitualOpen(false)}
        onDismiss={() => {
          // Silences it until the next ritual day, and nothing else happens:
          // no banner, no card in the feed, nothing that keeps asking.
          if (typeof window !== 'undefined') {
            localStorage.setItem('mooves.weekRitualDismissed', toLocalDateStr(weekDates(ritualDay)[0]))
          }
          setRitualOpen(false)
        }}
        onSaved={count => {
          setRitualOpen(false)
          setToastMessage(count === 0 ? 'Nothing set this week.' : 'Your week is set.')
        }}
      />

      {/* 22.4 — the confirm, and the ordinary green it makes. */}
      {confirmParts && (
        <ConfirmFreeSheet
          open
          parts={confirmParts}
          ritualDay={ritualDay}
          onClose={() => setConfirmParts(null)}
          onConfirmed={(statusTime, expiresAt) => {
            setConfirmParts(null)
            // Straight into the same state the swipe produces — no separate
            // "scheduled" flag anywhere, because it is just a green.
            setIsAvailable(true)
            setMyStatusTime(statusTime)
            setMyStatusExpiresAt(expiresAt)
            setMyStatusNote(null)
            setMyVisibleGroupIds([])
            setMyShowGroups(false)
            markValueMoment()
            setToastMessage("You're free.")
            scheduleRefetch()
          }}
        />
      )}

      {toastMessage && (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      )}
    </div>
  )
}
