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
import WaveStrip from './WaveStrip'
import TipJar from './TipJar'
import AmbientTier from './AmbientTier'
import MoovesEmpty from './MoovesEmpty'
import MooveCard from './MooveCard'
import { feedCardCount } from '@/lib/nearMatch'
import type { NearMove } from '@/app/api/discover/route'
import RoundupJoinedSheet from './RoundupJoinedSheet'
import Rail from './Rail'
import { railSeed, type RailPerson } from '@/lib/rail'
import PlanCard from './PlanCard'
import PlanComposer, { type PlanPrefill } from './PlanComposer'
import MooveActionsSheet from './MooveActionsSheet'
import MooveSheet, { type MoovePane } from './MooveSheet'
import GreenSheet from './GreenSheet'
import type { PickableFriend } from '@/components/visibility/FriendPickerPane'
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
  // R16 — every friend, for the specific-friends picker. /api/friends was
  // already being fetched on load and everything but the ids thrown away; the
  // picker costs no extra round trip, only the names and avatars we discarded.
  const [allFriends, setAllFriends] = useState<PickableFriend[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [isAvailable, setIsAvailable] = useState(false)
  const [myStatusNote, setMyStatusNote] = useState<string | null>(null)
  const [myStatusTime, setMyStatusTime] = useState<string | null>(null)
  // 18.2 — your own green's group scope. Names resolve client-side against the
  // groups list already loaded, so this needs no extra round trip.
  const [myVisibleGroupIds, setMyVisibleGroupIds] = useState<string[]>([])
  // R16 — your own green's INDIVIDUAL scope, beside its group scope.
  const [myVisibleUserIds, setMyVisibleUserIds] = useState<string[]>([])
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
  // Rail is people, feed is Mooves.
  const [plans, setPlans] = useState<Plan[]>([])
  const [composerOpen, setComposerOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [actionsPlan, setActionsPlan] = useState<Plan | null>(null)
  // Phase 21, second revision — one sheet for the whole feed, opened on the
  // pane the tapped half of the card asked for.
  const [sheet, setSheet] = useState<{ plan: Plan; pane: MoovePane } | null>(null)
  const [planPrefill, setPlanPrefill] = useState<PlanPrefill | null>(null)
  // 24.6 — Community and Sponsored Mooves, in the feed rather than in a tab
  // nobody visited. Fetched once at the maximum any state needs (3) and sliced
  // by feedCardCount, so going green does not trigger a refetch.
  const [nearMoves, setNearMoves] = useState<NearMove[]>([])
  /**
   * ?plan=<id> — where the "tagged you in a Moove" push lands.
   *
   * Held until the plans arrive, then resolved into the sheet. It opens on
   * "Who's in", NEVER on comments: a tagged friend has not joined, so wall 3
   * still applies and the sheet gives them the way in ("I'm in") rather than
   * the conversation. Read once on mount; the URL is scrubbed immediately so a
   * refresh does not reopen it.
   */
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null)
  // R17 — "Your green", opened by tapping your own face in the rail. Replaces
  // both MyMoveCard and the standalone Free-until sheet, which is now a pane.
  const [greenSheetOpen, setGreenSheetOpen] = useState(false)
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

  // R21 — the grey tail's shuffle, seeded ONCE per app open. Lazy so it is not
  // recomputed on every render. The rail only mounts after the fetches resolve,
  // so this never reaches the server pass and cannot desync hydration.
  const [seed] = useState(railSeed)

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
        visibleUserIds?: string[] | null
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
      setMyVisibleUserIds(greenExpired ? [] : meData.visibleUserIds ?? [])
      setMyShowGroups(greenExpired ? false : meData.statusShowGroups === true)
      setReferralCode(meData.referralCode ?? null)

      await resolveInvite()
      await resolveGroupInvite()
      await resolveRoundup()
      if (!mountedRef.current) return

      const [friendsRes, feedRes, groupsRes, plansRes] = await Promise.all([
        fetch('/api/friends').then(r => r.json()) as Promise<{ friends: PickableFriend[] }>,
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
      setAllFriends(friendsRes.friends ?? [])
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

      // 24.6 — the near-you shelf. Fire-and-forget: it is the last thing on the
      // screen in every state, so a slow or failed fetch must never hold up the
      // rail or the Mooves list.
      void fetch('/api/discover?limit=3')
        .then(r => (r.ok ? r.json() : null))
        .then((d: { moves?: NearMove[] } | null) => {
          if (d?.moves && mountedRef.current) setNearMoves(d.moves)
        })
        .catch(() => {
          /* the shelf just does not render */
        })

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

      // R1 — arriving from the nav's "Plan a Moove" on another tab. The button
      // is global but the composer belongs to the feed, so the other three tabs
      // route here and open it on landing.
      if (searchParams.get('compose') === '1') {
        setEditingPlan(null)
        setPlanPrefill(null)
        setComposerOpen(true)
        if (typeof window !== 'undefined') window.history.replaceState({}, '', '/feed')
      }

      // Arriving from a "tagged you in a Moove" push. Stashed rather than acted
      // on: the sheet needs the Plan itself, and if the Moove has since expired
      // or been cancelled it will simply not be in the list — in which case
      // nothing opens, which is the correct outcome.
      const taggedPlan = searchParams.get('plan')
      if (taggedPlan) {
        setPendingPlanId(taggedPlan)
        posthog.capture('tag_push_opened')
        if (typeof window !== 'undefined') window.history.replaceState({}, '', '/feed')
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

  // R22 — the slide is gone; your own tile in the rail is the way to green.
  function handleGoFreeTap() {
    posthog.capture('go_green_sheet_opened', { source: 'rail_tile' })
    setSheetOpen(true)
  }

  function handleGoGreenSuccess(move: {
    statusNote: string | null
    statusTime: string | null
    visibleGroupIds: string[]
    visibleUserIds: string[]
    showGroups: boolean
    expiresAt: string | null
  }) {
    setIsAvailable(true)
    setMyStatusNote(move.statusNote)
    setMyStatusTime(move.statusTime)
    // 18.2 — the sheet reports its own selection; /api/users/me isn't refetched here.
    // R16: what it reports is what the SERVER stored, so ids dropped for not
    // being real friendships never linger in the chip.
    setMyVisibleGroupIds(move.visibleGroupIds)
    setMyVisibleUserIds(move.visibleUserIds)
    setMyShowGroups(move.showGroups)
    setMyStatusExpiresAt(move.expiresAt)
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

  // Resolve a ?plan= deep link once the feed has actually loaded. Cleared
  // either way, so a Moove that is gone does not leave this armed forever.
  useEffect(() => {
    if (!pendingPlanId || plans.length === 0) return
    const target = plans.find(p => p.id === pendingPlanId)
    setPendingPlanId(null)
    if (target) setSheet({ plan: target, pane: 'who' })
  }, [pendingPlanId, plans])

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
          // R16 — every /api/status write must carry BOTH scopes. Omitting this
          // one would quietly drop the named friends off the green the next time
          // its deadline moved.
          visibleUserIds: myVisibleUserIds.length > 0 ? myVisibleUserIds : null,
          statusShowGroups: myShowGroups,
          statusExpiresAt: iso,
        }),
      })
    } catch {
      setToastMessage("Couldn't update, try again.")
    }
  }

  /**
   * R17 — a visibility change made from the green modal, while already green.
   *
   * Optimistic, then reconciled against what the server actually stored: R16
   * drops ids that are not real friendships, so trusting the local list would
   * leave the chip claiming an audience that does not exist.
   */
  async function handleGreenVisibilityChange(next: {
    visibleGroupIds: string[]
    visibleUserIds: string[]
    showGroups: boolean
  }) {
    const previous = {
      visibleGroupIds: myVisibleGroupIds,
      visibleUserIds: myVisibleUserIds,
      showGroups: myShowGroups,
    }
    setMyVisibleGroupIds(next.visibleGroupIds)
    setMyVisibleUserIds(next.visibleUserIds)
    setMyShowGroups(next.showGroups)
    try {
      const res = await fetch('/api/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isAvailable: true,
          statusNote: myStatusNote,
          statusTime: myStatusTime,
          visibleTo: next.visibleGroupIds.length > 0 ? next.visibleGroupIds : null,
          visibleUserIds: next.visibleUserIds.length > 0 ? next.visibleUserIds : null,
          statusShowGroups: next.showGroups,
          statusExpiresAt: myStatusExpiresAt,
        }),
      })
      if (!res.ok) throw new Error('update failed')
      const data = (await res.json()) as {
        visibleTo: string[] | null
        visibleUserIds: string[] | null
      }
      setMyVisibleGroupIds(data.visibleTo ?? [])
      setMyVisibleUserIds(data.visibleUserIds ?? [])
    } catch {
      setMyVisibleGroupIds(previous.visibleGroupIds)
      setMyVisibleUserIds(previous.visibleUserIds)
      setMyShowGroups(previous.showGroups)
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
      setMyVisibleUserIds([])
      setMyShowGroups(false)
      setMyJoiners([])
      posthog.capture('go_grey_confirmed')
    }
    setGreyOpen(false)
    setPlanOpen(false)
    setJoinedPromptOpen(false)
  }

  // 9.5 Part B — sheet heading from the real joiner names.
  //
  // "…are in" alone never said in for WHAT, which on a feed with more than one
  // Moove is a question the reader has to go and answer themselves.
  //
  // `myJoiners` cannot answer it: get_feed returns it as one flat list of
  // everyone who has joined anything of yours, greens and Mooves together, with
  // no plan_id to group by. Rather than redefine get_feed for a heading — it has
  // been silently broken twice by redefinition — the title is derived here from
  // the plans already loaded: your own live Moove with the most joiners, which
  // is overwhelmingly the one those names came from. With no such Moove the
  // suffix is dropped rather than guessed.
  function joinedMooveTitle(): string | null {
    const mine = plans.filter(p => p.isMine && p.joiners.length > 0)
    if (mine.length === 0) return null
    return mine.reduce((a, b) => (b.joiners.length > a.joiners.length ? b : a)).title
  }

  function joinedHeading(): string {
    const names = myJoiners.map(j => j.displayName ?? 'A friend')
    const title = joinedMooveTitle()
    const suffix = title ? ` for ${title}` : ''
    if (names.length === 1) return `${names[0]} is in${suffix}`
    if (names.length === 2) return `${names[0]} and ${names[1]} are in${suffix}`
    return `${names[0]}, ${names[1]} and ${names.length - 2} more are in${suffix}`
  }

  // 24.7 — the card's single CTA. Opens the planned-Moove composer prefilled and
  // carrying the anchor, so brought_over_count still increments and the sponsor
  // keeps attribution (13.8's contract, unchanged).
  //
  // No round-trip through ?anchor=: that path exists for arrivals from OUTSIDE
  // the feed, and here we already hold the whole move.
  //
  // locationText is the VENUE, not the neighbourhood. The card shows the
  // neighbourhood; a Moove needs somewhere to actually meet.
  function handleMakeMoove(move: NearMove) {
    posthog.capture('near_make_moove', { move: move.id, origin: move.origin })
    setEditingPlan(null)
    setPlanPrefill({
      sponsoredMoveId: move.id,
      title: move.title,
      startAt: move.startAt,
      locationText: move.locationText,
      note: move.description,
    })
    setComposerOpen(true)
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

  // ── R21 rail derivation ────────────────────────────────────────────────────
  //
  // Everyone, always: `allFriends` is the whole friend list, `friends` is the
  // subset get_feed says is green AND visible to you. Layering the second over
  // the first is what makes the privacy rule structural — a friend whose green
  // is scoped away from you is simply absent from `friends`, so they land in
  // the grey tail with nothing to distinguish them, and there is no filter here
  // that anyone could later forget to apply.
  //
  // It is a UNION, not a lookup over `allFriends` alone. `allFriends` is
  // fetched once on mount; a friendship formed mid-session would otherwise make
  // a live green invisible, which is far worse than the accepted cost of a
  // grey face arriving late.
  const greenById = new Map((friends ?? []).map(f => [f.id, f]))
  const railFriends: RailPerson[] = allFriends.map(f => {
    const green = greenById.get(f.id)
    return {
      id: f.id,
      displayName: f.displayName,
      avatarUrl: f.avatarUrl,
      isGreen: !!green,
      statusTime: green?.statusTime ?? null,
      greenSince: green?.statusSetAt ? Date.parse(green.statusSetAt) : null,
    }
  })
  const known = new Set(allFriends.map(f => f.id))
  for (const f of friends ?? []) {
    if (known.has(f.id)) continue
    railFriends.push({
      id: f.id,
      displayName: f.displayName,
      avatarUrl: f.avatarUrl,
      isGreen: true,
      statusTime: f.statusTime ?? null,
      greenSince: f.statusSetAt ? Date.parse(f.statusSetAt) : null,
    })
  }
  const railPeople: RailPerson[] = [
    ...(me
      ? [{
          id: me.id,
          displayName: me.displayName,
          avatarUrl: me.avatarUrl,
          isGreen: isAvailable,
          statusTime: myStatusTime,
          greenSince: null,
          isMe: true,
        }]
      : []),
    ...railFriends,
  ]

  // R17 — the rail's selection state is gone with the card it drove. It existed
  // to say WHICH green's card was expanded below the rail; there are no green
  // cards left. Your own face opens the green modal, a friend's face opens
  // Messages, and neither is a selection. (`selectedFriend` went with it — it
  // had already been dead code, declared and never rendered.)
  return (
    <div className="min-h-screen flex flex-col bg-purple-50">
      {/* R14 — the gradient band and its lockup are gone entirely. The page
          background now runs to the top edge under the status bar, and the
          "Free" rail is the first thing on screen. */}
      <div className="flex-1 flex flex-col px-4 [--safe-pt-base:0.75rem] safe-area-pt pb-[calc(var(--nav-h)+22px+env(safe-area-inset-bottom))]">
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
            {/* R21/R22 — one surface at the top of the screen instead of two.
                The rail holds everyone and never hides, and your own tile is
                both how you say you are free and how you change it. There is no
                separate control on the feed any more, in either state. */}
            <Rail
              people={railPeople}
              seed={seed}
              onOpenMine={() => (isAvailable ? setGreenSheetOpen(true) : handleGoFreeTap())}
              onText={id => {
                const f = (friends ?? []).find(x => x.id === id)
                if (!f?.phone) return
                posthog.capture('rail_tap_sms_opened')
                window.location.href = `sms:${f.phone}`
              }}
            />

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

                {/* 24.6, cold start. Inviting stays the one primary action and
                    keeps its place above; these sit below a divider so they read
                    as context, not as the ask. No social line can appear here —
                    there is nobody to put on one — which is the honest version
                    and also the argument for inviting. */}
                {nearMoves.length > 0 && (
                  <div className="w-full mt-6 text-left">
                    <div className="flex items-center gap-[11px] px-0.5 pb-3">
                      <span className="flex-1 h-px bg-[#E8E4F5]" />
                      <span className="font-sans text-[10.5px] font-bold uppercase tracking-[0.1em] text-grey-300">
                        Meanwhile, near you
                      </span>
                      <span className="flex-1 h-px bg-[#E8E4F5]" />
                    </div>
                    {nearMoves
                      .slice(0, feedCardCount({ hasFriends: false, anyGreen: false, anyPlans: false }))
                      .map(m => (
                        <MooveCard key={m.id} move={m} onMakeMoove={handleMakeMoove} />
                      ))}
                  </div>
                )}
              </div>
            ) : friends.length === 0 && plans.length === 0 ? (
              // 20.4 — the ambient tier only when BOTH surfaces are empty.
              <>
                <AmbientTier activeNow={ambient.activeNow} recentGreen={ambient.recentGreen} />

                {/* 24.6, and this is the state the whole thing is for. Friends
                    exist, none are free, nothing is planned — the moment people
                    close the app. It gets the most room of any state because
                    there is nothing here to compete with. */}
                {nearMoves.length > 0 && (
                  <div className="mt-1">
                    <p className="font-sans text-[10.5px] font-bold text-ink-500 uppercase tracking-[0.1em] px-0.5 pt-1 pb-2.5">
                      Near you tonight
                    </p>
                    {nearMoves
                      .slice(0, feedCardCount({ hasFriends: true, anyGreen: false, anyPlans: false }))
                      .map(m => (
                        <MooveCard key={m.id} move={m} onMakeMoove={handleMakeMoove} />
                      ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Green cards for friends are gone: a friend's face in the rail
                    goes straight to Messages. Greens carry availability,
                    Mooves carry commitment — so "I'm in", rosters and the group
                    blast now live only on Mooves. */}
                {/* The label is unconditional in this branch. It used to render
                    only alongside cards, so a viewer with green friends and no
                    Mooves got no label AND no cards — a blank slab of feed that
                    read as broken rather than as empty. */}
                <p className="font-sans text-[10.5px] font-bold text-ink-500 uppercase tracking-[0.1em] px-0.5 pt-1 pb-2.5">
                  Mooves
                </p>
                {plans.length > 0 ? (
                  plans.map(p => (
                    <PlanCard
                      key={p.id}
                      plan={p}
                      meId={me.id}
                      onToggleJoin={handleTogglePlanJoin}
                      onBlast={handlePlanBlast}
                      onActions={setActionsPlan}
                      onOpenSheet={(plan, pane) => setSheet({ plan, pane })}
                    />
                  ))
                ) : (
                  <MoovesEmpty
                    onPlan={() => {
                      posthog.capture('mooves_empty_plan_tapped')
                      setEditingPlan(null)
                      setPlanPrefill(null)
                      setComposerOpen(true)
                    }}
                  />
                )}

                {/* 24.6, the busy case. Your people are using the screen, so
                    this is ONE card in last position. Prominence scales through
                    card count, never through a second layout mode — there is
                    nothing horizontal below the rail, because the rail is
                    already this screen's side-to-side gesture. */}
                {nearMoves.length > 0 && (
                  <div className="mt-3.5">
                    <div className="flex items-baseline justify-between px-0.5 pb-2">
                      <span className="font-sans text-[10.5px] font-bold text-ink-500 uppercase tracking-[0.1em]">
                        Near you tonight
                      </span>
                      <button
                        onClick={() => {
                          posthog.capture('near_see_all_tapped')
                          router.push('/discover')
                        }}
                        className="font-sans text-[10.5px] font-bold text-purple-500 tracking-[0.04em]"
                      >
                        See all
                      </button>
                    </div>
                    {nearMoves
                      .slice(
                        0,
                        feedCardCount({
                          hasFriends: true,
                          anyGreen: friends.length > 0,
                          anyPlans: plans.length > 0,
                        }),
                      )
                      .map(m => (
                        <MooveCard key={m.id} move={m} onMakeMoove={handleMakeMoove} />
                      ))}
                  </div>
                )}

                {/* Phase 14.1: tip jar at the very bottom, only when 3+ moves are
                    live (greens + Mooves + your own green). Self-hides below 3. */}
                <TipJar visible={friends.length + plans.length + (isAvailable ? 1 : 0) >= 3} />
              </>
            )}
          </>
        )}
      </div>

      <BottomNav
        onPlanTap={() => {
          setEditingPlan(null)
          setPlanPrefill(null)
          setComposerOpen(true)
        }}
      />

      <GoGreenSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
          setPendingAnchor(null)
        }}
        groups={groups}
        friends={allFriends}
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
            Sounds like something came together. Go grey if that&apos;ll be it for the night, or keep
            it open for more.
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

      {/* R1 — the floating "+" is gone. The plan path now lives in the centre of
          the nav, which is still deliberately far from the swipe (opposite end
          of the screen) so the two creation gestures are never confused, and no
          longer sits on top of the card underneath it. */}

      <PlanComposer
        open={composerOpen}
        onClose={() => {
          setComposerOpen(false)
          setEditingPlan(null)
          setPlanPrefill(null)
        }}
        groups={groups}
        friends={allFriends}
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

      {sheet && me && (
        <MooveSheet
          plan={sheet.plan}
          meId={me.id}
          initialPane={sheet.pane}
          onClose={() => setSheet(null)}
          onJoin={() => {
            handleTogglePlanJoin(sheet.plan.id, false)
            setSheet(null)
          }}
          onCountChange={(planId, count) =>
            setPlans(prev => prev.map(p => (p.id === planId ? { ...p, commentCount: count } : p)))
          }
        />
      )}

      {/* R17 — everything you can do about your own green, in one sheet. */}
      <GreenSheet
        open={greenSheetOpen && isAvailable}
        onClose={() => setGreenSheetOpen(false)}
        statusTime={myStatusTime}
        statusExpiresAt={myStatusExpiresAt}
        anchoredMove={myAnchoredMove}
        groups={groups}
        friends={allFriends}
        visibleGroupIds={myVisibleGroupIds}
        visibleUserIds={myVisibleUserIds}
        showGroups={myShowGroups}
        onVisibilityChange={next => void handleGreenVisibilityChange(next)}
        onExpiryChange={iso => void handleSetFreeUntil(iso)}
        onGoGrey={() => {
          setGreenSheetOpen(false)
          setGreyOpen(true)
        }}
      />


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
