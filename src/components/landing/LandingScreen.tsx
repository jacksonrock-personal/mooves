// Phase 14.2 — Landing page (makemooves.app).
// A responsive marketing page for logged-out visitors: explains the core loop
// (go green → friends see it → plan over text) and drives into the app (/auth).
// Deliberately NOT the 320px phone-frame — mobile-first, widens on desktop.
// Rendered by src/app/page.tsx only when there's no valid session.
'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import CowMark from '@/components/ui/CowMark'
import { initPostHog, posthog } from '@/lib/posthog'

export default function LandingScreen() {
  useEffect(() => {
    initPostHog()
    posthog.capture('landing_view')
  }, [])

  const onCta = (location: string) => posthog.capture('landing_cta_click', { location })

  return (
    <div className="min-h-screen bg-purple-50 text-ink-900">
      <div className="mx-auto max-w-[1120px]">
        {/* NAV */}
        <nav className="flex items-center justify-between px-6 py-[18px]">
          <div className="flex items-center gap-[10px]">
            <div className="flex h-[38px] w-[38px] items-center justify-center overflow-hidden rounded-[11px] bg-white shadow-[0_1px_2px_rgba(28,23,48,0.06)]">
              <CowMark size={30} />
            </div>
            <span className="font-display text-[20px] font-extrabold tracking-[-0.02em] text-ink-900">Mooves</span>
          </div>
          <Link
            href="/auth"
            onClick={() => onCta('nav')}
            className="inline-flex min-h-[44px] items-center rounded-full border-[1.5px] border-purple-100 bg-white px-4 text-[14px] font-semibold text-purple-500"
          >
            Open app
          </Link>
        </nav>

        {/* HERO */}
        <header className="relative overflow-hidden px-6 pb-12 pt-7 text-center md:pb-16 md:pt-11">
          <div className="pointer-events-none absolute left-1/2 top-[-40px] h-[420px] w-[420px] -translate-x-1/2 bg-[radial-gradient(circle,rgba(46,204,113,0.18),transparent_62%)]" />
          <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center overflow-hidden rounded-[26px] bg-white shadow-[0_8px_24px_rgba(28,23,48,0.14)]">
            <CowMark size={72} />
          </div>
          <div className="relative mb-[18px] inline-flex items-center gap-[7px] rounded-full bg-green-100 px-[14px] py-[7px] text-[12.5px] font-semibold text-green-700">
            <span className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_0_3px_rgba(46,204,113,0.25)]" />
            Green means you&apos;re free
          </div>
          <h1 className="relative mx-auto mb-[18px] max-w-[560px] font-display text-[38px] font-extrabold leading-[1.08] tracking-[-0.025em] text-ink-900 md:text-[52px]">
            The easiest way to actually hang out.
          </h1>
          <p className="relative mx-auto mb-[30px] max-w-[452px] text-[17.5px] font-medium leading-[1.55] text-ink-500 md:text-[19px]">
            Go green when you&apos;re free. The friends you picked see it. You make the plan over text.{' '}
            <b className="font-semibold text-ink-900">That&apos;s it.</b>
          </p>
          <Link
            href="/auth"
            onClick={() => onCta('hero')}
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-purple-500 px-[30px] text-[16px] font-semibold text-white shadow-[0_8px_24px_rgba(124,92,219,0.32)] transition-colors hover:bg-purple-700"
          >
            Make Mooves
          </Link>
          <p className="relative mt-4 text-[13.5px] text-ink-500">Free, and takes a minute to set up.</p>
          <a
            href="#loop"
            aria-label="See how it works"
            className="relative mt-5 inline-flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-purple-100 bg-white text-[20px] font-bold text-purple-500 shadow-[0_1px_2px_rgba(28,23,48,0.06)] transition-transform hover:translate-y-[2px]"
          >
            ↓
          </a>
        </header>

        {/* CORE LOOP */}
        <section id="loop" className="px-6 py-13 md:py-14">
          <div className="mx-auto mb-[34px] max-w-[560px] text-center">
            <h2 className="font-display text-[27px] font-extrabold leading-[1.18] tracking-[-0.02em] text-ink-900 md:text-[32px]">
              Three taps from bored to booked.
            </h2>
          </div>
          <div className="mx-auto flex max-w-[520px] flex-col gap-[18px] md:max-w-[1000px] md:flex-row md:items-stretch">
            {/* Beat 1 */}
            <div className="flex flex-1 items-start gap-[18px] rounded-[20px] bg-white p-6 shadow-[0_1px_2px_rgba(28,23,48,0.06)] md:flex-col">
              <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-purple-100 font-display text-[15px] font-extrabold text-purple-700 md:order-1">
                1
              </div>
              <div className="flex h-[54px] w-[78px] shrink-0 items-center justify-center md:order-2 md:h-[54px] md:w-full md:justify-start">
                <div className="inline-flex items-center gap-[7px] rounded-full bg-green-100 px-3 py-2">
                  <span className="h-[9px] w-[9px] rounded-full bg-green-500" />
                  <span className="text-[12px] font-semibold text-green-700">You&apos;re free</span>
                </div>
              </div>
              <div className="flex-1 md:order-3">
                <h3 className="mb-[6px] font-display text-[18px] font-extrabold tracking-[-0.01em] text-ink-900">Go green</h3>
                <p className="text-[14.5px] leading-[1.5] text-ink-500">Tap once when you&apos;re around. No status updates, no essays, just green.</p>
              </div>
            </div>
            {/* Beat 2 */}
            <div className="flex flex-1 items-start gap-[18px] rounded-[20px] bg-white p-6 shadow-[0_1px_2px_rgba(28,23,48,0.06)] md:flex-col">
              <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-purple-100 font-display text-[15px] font-extrabold text-purple-700 md:order-1">
                2
              </div>
              <div className="flex h-[54px] w-[78px] shrink-0 items-center justify-center md:order-2 md:w-full md:justify-start">
                <div className="flex">
                  <div className="relative -ml-0 flex h-[30px] w-[30px] items-center justify-center rounded-full border-[2.5px] border-white bg-purple-500 font-display text-[12px] font-bold text-white">
                    M<span className="absolute -bottom-px -right-px h-[11px] w-[11px] rounded-full border-2 border-white bg-green-500" />
                  </div>
                  <div className="relative -ml-[9px] flex h-[30px] w-[30px] items-center justify-center rounded-full border-[2.5px] border-white bg-[#E8A0B4] font-display text-[12px] font-bold text-white">
                    J<span className="absolute -bottom-px -right-px h-[11px] w-[11px] rounded-full border-2 border-white bg-green-500" />
                  </div>
                  <div className="-ml-[9px] flex h-[30px] w-[30px] items-center justify-center rounded-full border-[2.5px] border-white bg-[#5FB0E8] font-display text-[12px] font-bold text-white">
                    R
                  </div>
                </div>
              </div>
              <div className="flex-1 md:order-3">
                <h3 className="mb-[6px] font-display text-[18px] font-extrabold tracking-[-0.01em] text-ink-900">Friends see it</h3>
                <p className="text-[14.5px] leading-[1.5] text-ink-500">The friends you added see you&apos;re free. No public feed, no strangers, nobody else.</p>
              </div>
            </div>
            {/* Beat 3 */}
            <div className="flex flex-1 items-start gap-[18px] rounded-[20px] bg-white p-6 shadow-[0_1px_2px_rgba(28,23,48,0.06)] md:flex-col">
              <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-purple-100 font-display text-[15px] font-extrabold text-purple-700 md:order-1">
                3
              </div>
              <div className="flex h-[54px] w-[78px] shrink-0 items-center justify-center md:order-2 md:w-full md:justify-start">
                <div className="flex flex-col items-end gap-[5px]">
                  <div className="max-w-[74px] rounded-[12px_12px_3px_12px] bg-purple-500 px-[10px] py-[6px] text-left text-[11px] font-medium text-white">wanna grab food?</div>
                  <div className="self-start max-w-[74px] rounded-[12px_12px_12px_3px] bg-grey-100 px-[10px] py-[6px] text-left text-[11px] font-medium text-ink-900">yes omw</div>
                </div>
              </div>
              <div className="flex-1 md:order-3">
                <h3 className="mb-[6px] font-display text-[18px] font-extrabold tracking-[-0.01em] text-ink-900">Plan over text</h3>
                <p className="text-[14.5px] leading-[1.5] text-ink-500">Tap a free friend to text them. The plan happens where it always has, in your messages.</p>
              </div>
            </div>
          </div>
        </section>

        {/* WHY DIFFERENT */}
        <section className="bg-ink-900 px-6 py-13 md:py-14">
          <div className="mx-auto mb-[34px] max-w-[560px] text-center">
            <h2 className="font-display text-[27px] font-extrabold leading-[1.18] tracking-[-0.02em] text-white md:text-[32px]">
              A little app that gets out of your way.
            </h2>
          </div>
          <div className="mx-auto flex max-w-[520px] flex-col gap-[14px] md:max-w-[1000px] md:flex-row">
            <div className="flex-1 rounded-[20px] border border-white/10 bg-white/[0.05] px-6 py-[22px]">
              <h3 className="mb-[6px] flex items-center gap-[10px] font-display text-[17px] font-extrabold text-white">
                <svg className="h-[22px] w-[22px] shrink-0" viewBox="0 0 24 24" fill="none">
                  <path d="M4 6h16M4 12h16M4 18h10" stroke="#A98FF0" strokeWidth="2.2" strokeLinecap="round" />
                  <line x1="3" y1="21" x2="21" y2="3" stroke="#2ECC71" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
                No feed to scroll
              </h3>
              <p className="text-[14.5px] leading-[1.5] text-white/[0.62]">Mooves shows who&apos;s free right now, then stops. There&apos;s nothing to keep scrolling, nothing to catch up on.</p>
            </div>
            <div className="flex-1 rounded-[20px] border border-white/10 bg-white/[0.05] px-6 py-[22px]">
              <h3 className="mb-[6px] flex items-center gap-[10px] font-display text-[17px] font-extrabold text-white">
                <svg className="h-[22px] w-[22px] shrink-0" viewBox="0 0 24 24" fill="none">
                  <path d="M12 21s-7-4.4-7-9.5A4.5 4.5 0 0 1 12 8a4.5 4.5 0 0 1 7 3.5C19 16.6 12 21 12 21z" stroke="#2ECC71" strokeWidth="2.2" strokeLinejoin="round" />
                </svg>
                No pressure
              </h3>
              <p className="text-[14.5px] leading-[1.5] text-white/[0.62]">A green just means you&apos;re around. No read receipts, no streaks, no seen-at, no reason to feel behind.</p>
            </div>
            <div className="flex-1 rounded-[20px] border border-white/10 bg-white/[0.05] px-6 py-[22px]">
              <h3 className="mb-[6px] flex items-center gap-[10px] font-display text-[17px] font-extrabold text-white">
                <svg className="h-[22px] w-[22px] shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle cx="9" cy="8" r="3.2" stroke="#A98FF0" strokeWidth="2.2" />
                  <path d="M3.5 19a5.5 5.5 0 0 1 11 0" stroke="#A98FF0" strokeWidth="2.2" strokeLinecap="round" />
                  <circle cx="17.5" cy="9" r="2.4" stroke="#2ECC71" strokeWidth="2.2" />
                </svg>
                Just your people
              </h3>
              <p className="text-[14.5px] leading-[1.5] text-white/[0.62]">You choose who&apos;s on your list. Your green is only ever visible to the friends you added, never the public.</p>
            </div>
          </div>
        </section>

        {/* CLOSING CTA */}
        <section className="relative px-6 py-[60px] text-center">
          <div className="pointer-events-none absolute left-1/2 top-[30px] h-[200px] w-[360px] -translate-x-1/2 bg-[radial-gradient(circle,rgba(124,92,219,0.16),transparent_66%)]" />
          <h2 className="relative mb-[14px] font-display text-[30px] font-extrabold tracking-[-0.02em] text-ink-900">Ready when you are.</h2>
          <p className="relative mb-7 text-[16px] font-medium text-ink-500">Add a couple friends, go green, see what happens.</p>
          <Link
            href="/auth"
            onClick={() => onCta('closing')}
            className="relative inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-purple-500 px-[30px] text-[16px] font-semibold text-white shadow-[0_8px_24px_rgba(124,92,219,0.32)] transition-colors hover:bg-purple-700"
          >
            Make Mooves
          </Link>
        </section>

        {/* FOOTER */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-purple-100 px-6 py-[26px]">
          <div className="flex items-center gap-2">
            <CowMark size={24} />
            <span className="font-display text-[15px] font-extrabold text-ink-900">Mooves</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-500">
            <Link href="/privacy" className="hover:text-ink-900">Privacy</Link>
            <Link href="/terms" className="hover:text-ink-900">Terms</Link>
            <span>© 2026 Mooves · makemooves.app</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
