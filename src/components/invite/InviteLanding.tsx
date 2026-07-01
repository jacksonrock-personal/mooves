'use client'

// Screen 1: Invite Link Landing Page
// Mockup: mooves-screen1-invite-landing.html
// Screen 12: sets sessionStorage invite code + carries it through auth via ?invite=.
//
// States rendered here:
//   A — new user (valid code):    "[Name] invited you to Mooves"  → /auth?invite=
//   B — existing user, not friends: "[Name] wants to see you"       → /feed?invite=
//   D — invalid code:              "You've been invited to Mooves"  → /auth?invite=
// State C (already friends) is handled by a server-side redirect to /feed.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { initPostHog, posthog } from '@/lib/posthog'

type LandingState = 'A' | 'B' | 'D'

interface InviteLandingProps {
  state: LandingState
  code: string
  inviterName: string | null
  inviterAvatarUrl: string | null
}

function initials(name: string | null): string {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function InviteLanding({
  state,
  code,
  inviterName,
  inviterAvatarUrl,
}: InviteLandingProps) {
  const router = useRouter()
  const [showDesktopNote, setShowDesktopNote] = useState(false)

  useEffect(() => {
    // Screen 12: persist the invite code so it survives the auth redirect.
    try {
      sessionStorage.setItem('mooves_invite_code', code)
    } catch {
      // sessionStorage unavailable (private mode) — the ?invite= URL param is the fallback.
    }

    initPostHog()
    posthog.capture('invite_page_viewed', {
      code,
      inviter_name: inviterName,
      is_valid_code: state !== 'D',
    })

    // Desktop-only "best on mobile" note, shown once per session.
    try {
      const dismissed = sessionStorage.getItem('mooves_desktop_note_dismissed')
      const isDesktop =
        typeof window !== 'undefined' &&
        window.matchMedia('(pointer: fine)').matches &&
        window.innerWidth > 640
      if (isDesktop && !dismissed) setShowDesktopNote(true)
    } catch {
      // ignore
    }
  }, [code, inviterName, state])

  function dismissDesktopNote() {
    setShowDesktopNote(false)
    try {
      sessionStorage.setItem('mooves_desktop_note_dismissed', '1')
    } catch {
      // ignore
    }
  }

  function handleCta() {
    posthog.capture('invite_cta_tapped', { code, is_new_user: state !== 'B' })

    if (state === 'B') {
      // Existing user: let the feed create the friendship + show the toast.
      router.push(`/feed?invite=${code}`)
    } else {
      posthog.capture('invite_auth_started', { code })
      router.push(`/auth?invite=${code}`)
    }
  }

  const heroName =
    state === 'A' ? (
      <>
        {inviterName} invited you
        <br />
        to Mooves
      </>
    ) : state === 'B' ? (
      <>
        {inviterName} wants to
        <br />
        see you on Mooves
      </>
    ) : (
      <>
        You&apos;ve been invited
        <br />
        to Mooves
      </>
    )

  const heroSub =
    state === 'B'
      ? "Tap below and you'll both be able to see when the other is free."
      : 'See when your friends are free, without having to ask.'

  const ctaLabel = state === 'B' ? "Let's Go" : 'Join'

  return (
    <main className="relative min-h-screen flex flex-col bg-gradient-to-b from-mooves-purple via-[#9B7FE8] to-[#A98FF0] overflow-hidden">
      {/* Background blobs */}
      <div className="pointer-events-none absolute -top-16 -right-16 w-52 h-52 rounded-full bg-white/[0.06]" />
      <div className="pointer-events-none absolute bottom-32 -left-8 w-32 h-32 rounded-full bg-status-green/[0.08]" />

      {showDesktopNote && (
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center gap-2 rounded-xl bg-black/25 px-3.5 py-2.5">
          <p className="flex-1 font-sans text-[11px] text-white/60 text-center">
            Made for mobile — works best in your phone&apos;s browser
          </p>
          <button
            onClick={dismissDesktopNote}
            className="text-white/60 text-sm leading-none px-1"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      )}

      {/* Wordmark */}
      <div className="relative z-[2] flex justify-center pt-14 px-6">
        <span className="flex items-center font-display font-extrabold text-[22px] text-white tracking-tight">
          M
          <span className="inline-flex items-center gap-[1px] relative top-[1px] mx-[1px]">
            <span className="w-[13px] h-[13px] rounded-full bg-status-green shadow-[0_0_8px_rgba(46,204,113,0.6)]" />
            <span className="w-[13px] h-[13px] rounded-full bg-white/30" />
          </span>
          VES
        </span>
      </div>

      {/* Hero */}
      <div className="relative z-[2] flex-1 flex flex-col items-center justify-center px-8">
        <div className="relative mb-6">
          <div className="absolute -inset-3 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.15)_0%,transparent_70%)]" />
          <div className="absolute -inset-1.5 rounded-full border-2 border-white/25" />
          {inviterAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={inviterAvatarUrl}
              alt={inviterName ?? 'Inviter'}
              width={88}
              height={88}
              className="relative z-[1] w-[88px] h-[88px] rounded-full object-cover border-[3px] border-white/30"
            />
          ) : (
            <div
              className="relative z-[1] w-[88px] h-[88px] rounded-full flex items-center justify-center border-[3px] border-white/30 font-display font-bold text-white bg-white/[0.15]"
              aria-label={inviterName ?? 'Mooves'}
            >
              {state === 'D' ? (
                <span className="text-4xl">🐮</span>
              ) : (
                <span className="text-[28px]">{initials(inviterName)}</span>
              )}
            </div>
          )}
        </div>

        <h1 className="font-display font-extrabold text-[22px] text-white text-center tracking-tight leading-tight mb-3">
          {heroName}
        </h1>
        <p className="font-sans text-[15px] text-white/70 text-center leading-relaxed max-w-[220px]">
          {heroSub}
        </p>
      </div>

      {/* CTA */}
      <div className="relative z-[2] px-6 pt-6 pb-11 flex flex-col gap-2.5">
        <button
          onClick={handleCta}
          className="w-full py-[17px] rounded-2xl bg-white text-mooves-purple font-display font-extrabold text-[17px] tracking-tight shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
        >
          {ctaLabel}
        </button>
        {state === 'A' && (
          <p className="font-sans text-[12px] text-white/50 text-center leading-relaxed">
            Takes about 2 minutes. No password needed.
          </p>
        )}
      </div>
    </main>
  )
}
