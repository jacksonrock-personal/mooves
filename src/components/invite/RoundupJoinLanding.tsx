'use client'

// Phase 19.1 — the /r/[code] landing, reached by pointing a phone camera at the
// host's screen. Mirrors GroupJoinLanding: this screen consents and routes, the
// feed completes the join (sessionStorage carries the code through auth).
//
// PRIVACY RULE, the core of this screen: consent shows the host's name and a
// COUNT, never the roster. Anyone holding the link would otherwise learn who is
// in the room. Same call Phase 10.2 made at build, shipping a member count
// instead of the specced avatar cluster. The dead and full states go further and
// reveal nothing at all, not even that a host exists by name.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { initPostHog, posthog } from '@/lib/posthog'

export type RoundupLandingState = 'consent' | 'already' | 'dead' | 'full'

interface RoundupJoinLandingProps {
  state: RoundupLandingState
  code: string
  hostName: string | null
  memberCount: number
  loggedIn: boolean
}

export default function RoundupJoinLanding({
  state,
  code,
  hostName,
  memberCount,
  loggedIn,
}: RoundupJoinLandingProps) {
  const router = useRouter()

  useEffect(() => {
    initPostHog()
    posthog.capture('roundup_invite_viewed', { state })
    if (state === 'consent') {
      try {
        sessionStorage.setItem('mooves_roundup_code', code)
      } catch {
        // private mode — the join just won't auto-complete after auth
      }
    }
  }, [code, state])

  function handleJoin() {
    posthog.capture('roundup_join_tapped', { logged_in: loggedIn })
    router.push(loggedIn ? '/feed' : '/auth')
  }

  function handleDismiss() {
    posthog.capture('roundup_declined')
    try {
      sessionStorage.removeItem('mooves_roundup_code')
    } catch {
      // ignore
    }
    router.push('/feed')
  }

  const tile = state === 'consent' ? '👋' : state === 'already' ? '✓' : '🐮'

  const heading =
    state === 'consent' ? (
      <>
        {hostName ?? 'A friend'} invited you
        <br />
        all to Mooves
      </>
    ) : state === 'already' ? (
      <>You&apos;re already in</>
    ) : state === 'full' ? (
      <>This one is full</>
    ) : (
      <>
        This link isn&apos;t
        <br />
        active anymore
      </>
    )

  const sub =
    state === 'consent'
      ? 'Joining will add everyone here as a friend, along with anyone who joins via the same code after.'
      : state === 'already'
        ? "You're friends with everyone here. Head back and see who's free."
        : state === 'full'
          ? 'It reached its 25 person limit. Ask whoever shared it to start another one.'
          : 'Codes stop working after 24 hours, or once the person who started it is done. Ask them for a fresh one.'

  return (
    <main className="relative min-h-screen flex flex-col bg-gradient-to-b from-purple-500 via-[#9B7FE8] to-[#A98FF0] overflow-hidden">
      <div className="pointer-events-none absolute -top-16 -right-16 w-52 h-52 rounded-full bg-white/[0.06]" />
      <div className="pointer-events-none absolute bottom-32 -left-8 w-32 h-32 rounded-full bg-green-500/[0.08]" />

      <div className="relative z-[2] flex justify-center pt-14 px-6">
        <span className="flex items-center font-display font-extrabold text-[22px] text-white tracking-tight">
          M
          <span className="inline-flex items-center gap-[1px] relative top-[1px] mx-[1px]">
            <span className="w-[13px] h-[13px] rounded-full bg-green-500 shadow-[0_0_8px_rgba(46,204,113,0.6)]" />
            <span className="w-[13px] h-[13px] rounded-full bg-white/30" />
          </span>
          VES
        </span>
      </div>

      <div className="relative z-[2] flex-1 flex flex-col items-center justify-center px-8">
        <div className="relative mb-6">
          <div className="absolute -inset-1.5 rounded-[28px] border-2 border-white/25" />
          <div className="relative z-[1] w-[88px] h-[88px] rounded-3xl flex items-center justify-center border-[3px] border-white/30 bg-white/[0.15] text-[42px] leading-none">
            {tile}
          </div>
        </div>

        <h1 className="font-display font-extrabold text-[24px] text-white text-center tracking-tight leading-tight mb-3">
          {heading}
        </h1>
        <p className="font-sans text-[15px] text-white/75 text-center leading-relaxed max-w-[246px]">
          {sub}
        </p>

        {/* Count only. Never the names. */}
        {state === 'consent' && memberCount > 0 && (
          <div className="mt-[18px] flex items-center gap-[7px] rounded-full bg-white/[0.14] border border-white/[0.18] px-3.5 py-[7px]">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            </svg>
            <span className="font-sans text-[12.5px] font-semibold text-white">
              {memberCount} {memberCount === 1 ? 'person' : 'people'} in so far
            </span>
          </div>
        )}
      </div>

      <div className="relative z-[2] px-6 pt-5 pb-11 flex flex-col items-center gap-3">
        {state === 'consent' ? (
          <>
            <button
              onClick={handleJoin}
              className="w-full py-[17px] rounded-2xl bg-white text-purple-500 font-display font-extrabold text-[17px] tracking-tight shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
            >
              Join
            </button>
            <button onClick={handleDismiss} className="font-sans text-[15px] font-semibold text-white/75">
              Not now
            </button>
            <p className="font-sans text-[12px] text-white/60 text-center leading-relaxed max-w-[250px]">
              No group is created, just friendships.
            </p>
          </>
        ) : (
          <button
            onClick={() => router.push('/feed')}
            className="w-full py-[17px] rounded-2xl bg-white text-purple-500 font-display font-extrabold text-[17px] tracking-tight shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
          >
            Go to Mooves
          </button>
        )}
      </div>
    </main>
  )
}
