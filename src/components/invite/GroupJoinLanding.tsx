'use client'

// Phase 10.2: Group invite link landing (consent / already-member / dead-link).
// Mirrors the friend InviteLanding pattern. The actual join happens on the feed
// via resolveGroupInvite — this screen stores the code + routes there (or to auth
// first when logged out; sessionStorage carries the code through auth).

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { initPostHog, posthog } from '@/lib/posthog'

type LandingState = 'consent' | 'already' | 'dead'

interface GroupJoinLandingProps {
  state: LandingState
  code: string
  name: string | null
  emoji: string | null
  memberCount: number
  loggedIn: boolean
}

export default function GroupJoinLanding({
  state,
  code,
  name,
  emoji,
  memberCount,
  loggedIn,
}: GroupJoinLandingProps) {
  const router = useRouter()

  useEffect(() => {
    initPostHog()
    posthog.capture('group_invite_viewed', { code, state, member_count: memberCount })
    // Persist the code so the feed can complete the join after auth (consent only).
    if (state === 'consent') {
      try {
        sessionStorage.setItem('mooves_group_invite_code', code)
      } catch {
        // sessionStorage unavailable (private mode) — join won't auto-complete.
      }
    }
  }, [code, state, memberCount])

  function handleJoin() {
    posthog.capture('group_invite_join_tapped', { code, logged_in: loggedIn })
    // Logged in → feed resolves + joins. Logged out → auth first (code is stored).
    router.push(loggedIn ? '/feed' : '/auth')
  }

  function handleDismiss() {
    posthog.capture('group_invite_declined', { code })
    try {
      sessionStorage.removeItem('mooves_group_invite_code')
    } catch {
      // ignore
    }
    router.push('/feed')
  }

  const heroName =
    state === 'consent' ? (
      <>Join {name}<br />on Mooves</>
    ) : state === 'already' ? (
      <>You&apos;re already<br />in {name}</>
    ) : (
      <>This invite is<br />no longer active</>
    )

  const heroSub =
    state === 'consent'
      ? `You'll join the group and connect with its ${memberCount} ${memberCount === 1 ? 'member' : 'members'}, so you see each other when you're free.`
      : state === 'already'
        ? "You're all set. Head back to see who's free."
        : 'The link may have been reset. Ask whoever shared it for a fresh one.'

  return (
    <main className="relative min-h-screen flex flex-col bg-gradient-to-b from-purple-500 via-[#9B7FE8] to-[#A98FF0] overflow-hidden">
      {/* Background blobs */}
      <div className="pointer-events-none absolute -top-16 -right-16 w-52 h-52 rounded-full bg-white/[0.06]" />
      <div className="pointer-events-none absolute bottom-32 -left-8 w-32 h-32 rounded-full bg-green-500/[0.08]" />

      {/* Wordmark */}
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

      {/* Hero */}
      <div className="relative z-[2] flex-1 flex flex-col items-center justify-center px-8">
        <div className="relative mb-6">
          <div className="absolute -inset-1.5 rounded-[28px] border-2 border-white/25" />
          <div className="relative z-[1] w-[88px] h-[88px] rounded-3xl flex items-center justify-center border-[3px] border-white/30 bg-white/[0.15] text-[42px] leading-none">
            {state === 'dead' ? '🐮' : (emoji ?? '👥')}
          </div>
        </div>

        <h1 className="font-display font-extrabold text-[24px] text-white text-center tracking-tight leading-tight mb-3">
          {heroName}
        </h1>
        <p className="font-sans text-[15px] text-white/75 text-center leading-relaxed max-w-[240px]">
          {heroSub}
        </p>
      </div>

      {/* CTA */}
      <div className="relative z-[2] px-6 pt-6 pb-11 flex flex-col items-center gap-3">
        {state === 'consent' ? (
          <>
            <button
              onClick={handleJoin}
              className="w-full py-[17px] rounded-2xl bg-white text-purple-500 font-display font-extrabold text-[17px] tracking-tight shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
            >
              Join {name}
            </button>
            <button
              onClick={handleDismiss}
              className="font-sans text-[15px] font-semibold text-white/75"
            >
              Not now
            </button>
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
