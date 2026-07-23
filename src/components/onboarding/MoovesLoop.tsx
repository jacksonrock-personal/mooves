'use client'

// Screen 3 (revised) — The Mooves Loop. Un-numbered onboarding finale, shown
// after Invite and immediately before the feed. Cards 1-3 teach the core loop
// (reusing the landing-page beats); card 4 is a launchpad that deep-links into
// the app. Reachable again from Settings via ?replay=1 (no completion write).
// Mockup: mooves-screen3-onboarding-loop.html

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog'

const CARD_COUNT = 5
const TRACK_TX = ['translate-x-0', '-translate-x-[20%]', '-translate-x-[40%]', '-translate-x-[60%]', '-translate-x-[80%]']
const STANCE_IDX = 3 // 17.3 — the stance card sits between Plan-over-text and the Launchpad

export default function MoovesLoop() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get('invite')
  const replay = searchParams.get('replay') === '1'

  const [idx, setIdx] = useState(0)
  const [exiting, setExiting] = useState(false)
  const startXRef = useRef<number | null>(null)
  const stanceSeenRef = useRef(false)

  useEffect(() => {
    posthog.capture('onboarding_loop_viewed', { replay })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 17.3 — fire once when the stance card first lands on screen.
  useEffect(() => {
    if (idx === STANCE_IDX && !stanceSeenRef.current) {
      stanceSeenRef.current = true
      posthog.capture('onboarding_stance_viewed', { replay })
    }
  }, [idx, replay])

  const feedPath = inviteCode ? `/feed?invite=${inviteCode}` : '/feed'

  async function complete() {
    if (replay) return // already onboarded; Settings replay never re-writes
    try {
      await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingComplete: true }),
      })
      posthog.capture('onboarding_completed')
    } catch {
      // Non-blocking — feed re-checks completion and routes back if needed.
    }
  }

  async function exitTo(path: string, opts?: { launchpad?: string; skipped?: boolean }) {
    if (exiting) return
    setExiting(true)
    if (opts?.launchpad) posthog.capture('onboarding_launchpad_tapped', { destination: opts.launchpad, replay })
    else if (opts?.skipped) posthog.capture('onboarding_loop_skipped')
    else posthog.capture('onboarding_loop_completed')
    await complete()
    // On a Settings replay, Skip / Let's go return to Settings, but a launchpad
    // row still takes you to the real destination.
    if (replay && !opts?.launchpad) {
      router.replace('/settings')
      return
    }
    router.replace(path)
  }

  function advance() {
    if (idx < CARD_COUNT - 1) setIdx(idx + 1)
    else void exitTo(feedPath) // "Let's go" on the last card
  }

  function goTo(i: number) {
    setIdx(Math.max(0, Math.min(CARD_COUNT - 1, i)))
  }

  function onPointerDown(e: React.PointerEvent) {
    startXRef.current = e.clientX
  }
  function onPointerUp(e: React.PointerEvent) {
    if (startXRef.current === null) return
    const dx = e.clientX - startXRef.current
    if (dx < -40 && idx < CARD_COUNT - 1) setIdx(idx + 1)
    else if (dx > 40 && idx > 0) setIdx(idx - 1)
    startXRef.current = null
  }

  return (
    <main className="min-h-screen bg-surface-bg flex flex-col relative overflow-hidden">
      {/* Skip (top-right) */}
      <div className="flex justify-end px-6 pt-6 h-[52px] shrink-0">
        <button
          onClick={() => void exitTo(feedPath, { skipped: true })}
          disabled={exiting}
          className="font-sans text-[14px] font-semibold text-text-secondary disabled:opacity-50"
        >
          {replay ? 'Done' : 'Skip'}
        </button>
      </div>

      {/* Carousel viewport */}
      <div className="flex-1 overflow-hidden" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <div className={`flex w-[500%] h-full transition-transform duration-[420ms] ease-out ${TRACK_TX[idx]}`}>

          {/* Card 1 — Go green (slide teaching visual) */}
          <div className="w-1/5 h-full flex flex-col items-center justify-center px-8 text-center">
            <div className="w-[200px] h-[168px] rounded-[28px] bg-green-100 flex items-center justify-center mb-8">
              <div className="relative w-[176px] h-[56px] rounded-full bg-green-700/10 border-[1.5px] border-green-700/20 flex items-center">
                <span className="absolute left-1 top-1 w-12 h-12 rounded-full bg-green-700 flex items-center justify-center shadow-[0_2px_8px_rgba(22,122,67,0.35)]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 6 10 12 4 18" opacity="0.45" />
                    <polyline points="10 6 16 12 10 18" />
                  </svg>
                </span>
                <span className="w-full text-center pl-11 font-display font-extrabold text-[15px] text-green-700 tracking-tight">
                  Slide to go free
                </span>
              </div>
            </div>
            <div className="font-sans text-[12px] font-bold tracking-[0.12em] uppercase text-mooves-purple mb-2.5">The Mooves Loop · 1</div>
            <h1 className="font-display font-extrabold text-[27px] text-text-primary tracking-tight mb-3 leading-[1.1]">Go green</h1>
            <p className="font-sans text-[15px] leading-relaxed text-text-secondary max-w-[250px]">
              Slide across when you&apos;re around. No status updates, no essays, just green.
            </p>
          </div>

          {/* Card 2 — Friends see it (avatar stack) */}
          <div className="w-1/5 h-full flex flex-col items-center justify-center px-8 text-center">
            <div className="w-[200px] h-[168px] rounded-[28px] bg-green-100 flex items-center justify-center mb-8">
              <div className="flex">
                <div className="relative w-[52px] h-[52px] rounded-full border-[3px] border-green-100 bg-purple-500 flex items-center justify-center font-display font-extrabold text-[19px] text-white">
                  M<span className="absolute -bottom-px -right-px w-[15px] h-[15px] rounded-full border-[2.5px] border-green-100 bg-green-500" />
                </div>
                <div className="relative -ml-3.5 w-[52px] h-[52px] rounded-full border-[3px] border-green-100 bg-[#E8A0B4] flex items-center justify-center font-display font-extrabold text-[19px] text-white">
                  J<span className="absolute -bottom-px -right-px w-[15px] h-[15px] rounded-full border-[2.5px] border-green-100 bg-green-500" />
                </div>
                <div className="-ml-3.5 w-[52px] h-[52px] rounded-full border-[3px] border-green-100 bg-[#5FB0E8] flex items-center justify-center font-display font-extrabold text-[19px] text-white">
                  R
                </div>
              </div>
            </div>
            <div className="font-sans text-[12px] font-bold tracking-[0.12em] uppercase text-mooves-purple mb-2.5">The Mooves Loop · 2</div>
            <h1 className="font-display font-extrabold text-[27px] text-text-primary tracking-tight mb-3 leading-[1.1]">Friends see it</h1>
            <p className="font-sans text-[15px] leading-relaxed text-text-secondary max-w-[250px]">
              The friends you added see you&apos;re free. No public feed, no strangers, nobody else.
            </p>
          </div>

          {/* Card 3 — Plan over text (bubbles) */}
          <div className="w-1/5 h-full flex flex-col items-center justify-center px-8 text-center">
            <div className="w-[200px] h-[168px] rounded-[28px] bg-purple-tint flex items-center justify-center mb-8">
              <div className="flex flex-col gap-2 w-[168px]">
                <div className="self-end max-w-[130px] px-3 py-2.5 rounded-[15px_15px_4px_15px] bg-purple-500 text-white text-left text-[13px] font-medium leading-tight">
                  wanna grab food?
                </div>
                <div className="self-start max-w-[130px] px-3 py-2.5 rounded-[15px_15px_15px_4px] bg-white text-text-primary text-left text-[13px] font-medium leading-tight shadow-[0_1px_3px_rgba(28,23,48,0.08)]">
                  yes omw
                </div>
              </div>
            </div>
            <div className="font-sans text-[12px] font-bold tracking-[0.12em] uppercase text-mooves-purple mb-2.5">The Mooves Loop · 3</div>
            <h1 className="font-display font-extrabold text-[27px] text-text-primary tracking-tight mb-3 leading-[1.1]">Plan over text</h1>
            <p className="font-sans text-[15px] leading-relaxed text-text-secondary max-w-[250px]">
              Tap a free friend to text them. The plan happens where it always has, in your messages.
            </p>
          </div>

          {/* Card 4 — Stance (17.3) */}
          <div className="w-1/5 h-full flex flex-col items-center justify-center px-8 text-center">
            <div className="w-[200px] h-[168px] rounded-[28px] bg-purple-tint flex items-center justify-center mb-8">
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#7C5CDB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a13.16 13.16 0 0 1-1.67 2.68" />
                <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 8 10 8a9.74 9.74 0 0 0 5.39-1.61" />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                <line x1="2" y1="2" x2="22" y2="22" />
              </svg>
            </div>
            <div className="font-sans text-[12px] font-bold tracking-[0.12em] uppercase text-mooves-purple mb-2.5">The Mooves Loop · 4</div>
            <h1 className="font-display font-extrabold text-[27px] text-text-primary tracking-tight mb-3 leading-[1.1]">The whole idea</h1>
            <div className="flex flex-col gap-2.5 max-w-[260px]">
              <p className="font-sans text-[15px] leading-snug text-text-secondary">We don&apos;t want your attention.</p>
              <p className="font-sans text-[15px] leading-snug text-text-secondary">We want you off the app and out the door.</p>
              <p className="font-display font-extrabold text-[17px] text-text-primary tracking-tight">Green means <span className="text-green-700">free.</span> That&apos;s it.</p>
            </div>
          </div>

          {/* Card 5 — Launchpad (single group-first CTA) */}
          <div className="w-1/5 h-full flex flex-col items-center justify-center px-7 text-center">
            <div className="w-[92px] h-[92px] rounded-[26px] bg-purple-tint flex items-center justify-center mb-6">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#7C5CDB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h1 className="font-display font-extrabold text-[25px] text-text-primary tracking-tight mb-1.5 leading-[1.14]">
              You&apos;re ready<br />to make Mooves.
            </h1>
            <p className="font-sans text-[14px] text-text-secondary mb-6">One thing to do first.</p>
            <div className="w-full">
              <LaunchRow
                tone="purple"
                title="Start your group"
                desc="Invite your whole crew with one link."
                icon={<GroupIcon />}
                onClick={() => void exitTo('/people/groups/new', { launchpad: 'group' })}
              />
              <button
                onClick={() => void exitTo(feedPath, { skipped: true })}
                disabled={exiting}
                className="block w-full text-center mt-4 font-sans text-[14px] font-semibold text-text-secondary disabled:opacity-50"
              >
                Maybe later
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-7 pb-11 pt-5 shrink-0">
        <div className="flex gap-1.5">
          {[0, 1, 2, 3, 4].map(i => (
            <button
              key={i}
              aria-label={`Card ${i + 1}`}
              onClick={() => goTo(i)}
              className={`h-2 rounded-full transition-all ${i === idx ? 'w-[22px] bg-mooves-purple' : 'w-2 bg-[#E8E4F5]'}`}
            />
          ))}
        </div>
        {idx < CARD_COUNT - 1 ? (
          <button
            onClick={advance}
            aria-label="Next"
            className="w-[54px] h-[54px] rounded-full bg-mooves-purple flex items-center justify-center shadow-[0_8px_20px_rgba(124,92,219,0.32)]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ) : (
          <button
            onClick={advance}
            disabled={exiting}
            className="h-[54px] px-6 rounded-full bg-mooves-purple text-white font-display font-extrabold text-[16px] tracking-tight shadow-[0_8px_20px_rgba(124,92,219,0.32)] disabled:opacity-50"
          >
            Let&apos;s go
          </button>
        )}
      </div>
    </main>
  )
}

function LaunchRow({
  tone,
  title,
  desc,
  icon,
  onClick,
}: {
  tone: 'purple' | 'green'
  title: string
  desc: string
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3.5 bg-white border-[1.5px] border-[#E8E4F5] rounded-[18px] p-[15px] text-left transition-colors active:border-mooves-purple"
    >
      <span className={`w-11 h-11 rounded-[13px] flex items-center justify-center shrink-0 ${tone === 'green' ? 'bg-green-100' : 'bg-purple-tint'}`}>
        {icon}
      </span>
      <span className="flex-1">
        <span className="block font-display font-extrabold text-[15px] text-text-primary tracking-tight mb-0.5">{title}</span>
        <span className="block font-sans text-[12.5px] text-text-secondary leading-snug">{desc}</span>
      </span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#BDB5D4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  )
}

function GroupIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7C5CDB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

