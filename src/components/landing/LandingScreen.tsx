// Phase 14.2 — Landing page (makemooves.app).
// A responsive marketing page for logged-out visitors, driving into the app (/auth).
// Deliberately NOT the 320px phone-frame — mobile-first, widens on desktop.
// Rendered by src/app/page.tsx only when there's no valid session.
//
// REVISED 2026-07-30 — the page still sold the Phase 9 product: go green, friends
// see it, text them. Since then the app grew a second object (planned Mooves,
// Phase 20), the join flow that hangs off it, and Discover (Phase 13). A visitor
// was being sold roughly half of what they'd find after signing up.
//
// The card visuals below are STATIC REPLICAS of PlanCard/SponsoredCard, not the
// components themselves — those need a live plan, handlers and a session. When
// either card's design changes, these need the same edit; that's the deliberate
// cost of not booting the feed on a marketing page.
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
          <p className="relative mx-auto mb-[30px] max-w-[500px] text-[17.5px] font-medium leading-[1.55] text-ink-500 md:text-[19px]">
            Go green when you&apos;re free. Or create a last-minute plan and let your friends join up.{' '}
            <b className="font-semibold text-ink-900">No big invites, just simple hangs.</b>
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

        {/* TWO WAYS — the product has two objects now, and the page has to say so
            before it explains joining, because "I'm in" only makes sense once
            there is a thing to be in. */}
        <section id="loop" className="px-6 py-13 md:py-14">
          <div className="mx-auto mb-[34px] max-w-[600px] text-center">
            <h2 className="font-display text-[27px] font-extrabold leading-[1.18] tracking-[-0.02em] text-ink-900 md:text-[32px]">
              Two ways to get something going.
            </h2>
            <p className="mx-auto mt-3 max-w-[440px] text-[15.5px] leading-[1.5] text-ink-500">
              One for when you&apos;re just around. One for when you&apos;ve actually got an idea.
            </p>
          </div>

          <div className="mx-auto flex max-w-[520px] flex-col gap-[18px] md:max-w-[1000px] md:flex-row md:items-stretch">
            {/* Go green */}
            <div className="flex flex-1 flex-col rounded-[20px] bg-white p-6 shadow-[0_1px_2px_rgba(28,23,48,0.06)]">
              <div className="mb-5 flex min-h-[76px] items-center">
                <SwipeVisual />
              </div>
              <h3 className="mb-2 font-display text-[19px] font-extrabold tracking-[-0.01em] text-ink-900">Go green</h3>
              <p className="text-[14.5px] leading-[1.5] text-ink-500">
                One swipe when you&apos;re around. The friends you picked see you&apos;re free — now, tonight, or all
                weekend — and they can just text you. No status update, no essay, no plan required.
              </p>
            </div>

            {/* Plan a Moove */}
            <div className="flex flex-1 flex-col rounded-[20px] bg-white p-6 shadow-[0_1px_2px_rgba(28,23,48,0.06)]">
              <div className="mb-5 flex min-h-[76px] items-center">
                <MooveCardVisual />
              </div>
              <h3 className="mb-2 font-display text-[19px] font-extrabold tracking-[-0.01em] text-ink-900">
                Plan a Moove
              </h3>
              <p className="text-[14.5px] leading-[1.5] text-ink-500">
                Got an idea? Name it and pick a day. Time, place and a note are all optional — &ldquo;tacos, Sunday&rdquo;
                is a complete Moove. Pick who sees it: everyone, a group, or a couple of specific friends.
              </p>
            </div>
          </div>
        </section>

        {/* JOINING */}
        <section className="px-6 py-13 md:py-14">
          <div className="mx-auto mb-[34px] max-w-[600px] text-center">
            <h2 className="font-display text-[27px] font-extrabold leading-[1.18] tracking-[-0.02em] text-ink-900 md:text-[32px]">
              Your friends just tap &ldquo;I&apos;m in&rdquo;.
            </h2>
            <p className="mx-auto mt-3 max-w-[440px] text-[15.5px] leading-[1.5] text-ink-500">
              No RSVPs, no maybes, no thread to keep up with.
            </p>
          </div>

          <div className="mx-auto flex max-w-[520px] flex-col items-center gap-8 md:max-w-[1000px] md:flex-row md:items-center md:gap-12">
            <div className="w-full max-w-[360px] shrink-0">
              <JoinedMooveVisual />
            </div>

            <ol className="flex flex-1 flex-col gap-[18px]">
              {[
                {
                  n: '1',
                  h: 'It shows up',
                  p: 'Your Moove lands in the feed of exactly the people you picked. Nothing public, nobody else.',
                },
                {
                  n: '2',
                  h: 'One tap to join',
                  p: 'They tap “I’m in” and they’re on the list. Everyone can see who else is coming before they commit.',
                },
                {
                  n: '3',
                  h: 'It moves to text',
                  p: 'Once two people are in, one tap opens a group text with exactly them. The plan happens in Messages, like it always has.',
                },
              ].map(s => (
                <li key={s.n} className="flex items-start gap-[18px] rounded-[20px] bg-white p-5 shadow-[0_1px_2px_rgba(28,23,48,0.06)]">
                  <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-purple-100 font-display text-[15px] font-extrabold text-purple-700">
                    {s.n}
                  </span>
                  <span className="flex-1">
                    <h3 className="mb-[6px] font-display text-[17px] font-extrabold tracking-[-0.01em] text-ink-900">
                      {s.h}
                    </h3>
                    <p className="text-[14.5px] leading-[1.5] text-ink-500">{s.p}</p>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* DISCOVER / SPONSORED */}
        <section className="px-6 py-13 md:py-14">
          {/* Not flex-col-reverse: on mobile that floated the sponsored card in
              above its own heading, so the first thing a visitor met in this
              section was an ad with no context for why it was there. */}
          <div className="mx-auto flex max-w-[520px] flex-col items-center gap-9 md:max-w-[1000px] md:flex-row md:items-center md:gap-12">
            <div className="flex-1">
              <span className="mb-[14px] inline-flex items-center gap-[7px] rounded-full bg-purple-100 px-[13px] py-[6px] text-[12px] font-bold uppercase tracking-[0.06em] text-purple-700">
                Discover
              </span>
              <h2 className="mb-3 font-display text-[27px] font-extrabold leading-[1.18] tracking-[-0.02em] text-ink-900 md:text-[32px]">
                When nobody has an idea.
              </h2>
              <p className="mb-4 text-[15.5px] leading-[1.55] text-ink-500">
                Discover is a short list of things actually happening near you — the run club, the trivia night, the
                Saturday market. Pick the kinds of things you like and it stays to those.
              </p>
              <p className="mb-4 text-[15.5px] leading-[1.55] text-ink-500">
                Find one you want to do and tap{' '}
                <b className="font-semibold text-ink-900">&ldquo;Go with friends&rdquo;</b>. It becomes your own Moove,
                on your friends&apos; feed, ready for them to join — so discovering something and getting people to come
                with you is the same two taps.
              </p>
              <p className="rounded-[14px] border border-purple-100 bg-white px-4 py-3 text-[13.5px] leading-[1.5] text-ink-500">
                Local spots pay to be listed here, and it says so on the card. They never appear in your friends&apos;
                feed, and they never see who you are.
              </p>
            </div>

            <div className="w-full max-w-[340px] shrink-0">
              <SponsoredCardVisual />
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
              <p className="text-[14.5px] leading-[1.5] text-white/[0.62]">
                Mooves shows who&apos;s free and what&apos;s planned, and then it stops. There&apos;s nothing to keep
                scrolling and nothing to catch up on.
              </p>
            </div>
            <div className="flex-1 rounded-[20px] border border-white/10 bg-white/[0.05] px-6 py-[22px]">
              <h3 className="mb-[6px] flex items-center gap-[10px] font-display text-[17px] font-extrabold text-white">
                <svg className="h-[22px] w-[22px] shrink-0" viewBox="0 0 24 24" fill="none">
                  <path d="M12 21s-7-4.4-7-9.5A4.5 4.5 0 0 1 12 8a4.5 4.5 0 0 1 7 3.5C19 16.6 12 21 12 21z" stroke="#2ECC71" strokeWidth="2.2" strokeLinejoin="round" />
                </svg>
                No pressure
              </h3>
              <p className="text-[14.5px] leading-[1.5] text-white/[0.62]">
                A green just means you&apos;re around, and it expires on its own. No read receipts, no streaks, no
                seen-at, no reason to feel behind.
              </p>
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
              <p className="text-[14.5px] leading-[1.5] text-white/[0.62]">
                You choose who&apos;s on your list, and you choose again every time you go green or plan a Moove. Never
                the public, never strangers.
              </p>
            </div>
          </div>
        </section>

        {/* CLOSING CTA */}
        <section className="relative px-6 py-[60px] text-center">
          <div className="pointer-events-none absolute left-1/2 top-[30px] h-[200px] w-[360px] -translate-x-1/2 bg-[radial-gradient(circle,rgba(124,92,219,0.16),transparent_66%)]" />
          <h2 className="relative mb-[14px] font-display text-[30px] font-extrabold tracking-[-0.02em] text-ink-900">Ready when you are.</h2>
          <p className="relative mb-7 text-[16px] font-medium text-ink-500">
            Add a couple friends, go green or plan something, see who turns up.
          </p>
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

/* ── Static replicas of real in-app surfaces ──────────────────────────────────
   Marketing screenshots that can't go stale silently — they're built from the
   same tokens as the components they mirror, so a token change moves both. */

/** SwipeToGoGreen, at rest. */
function SwipeVisual() {
  return (
    <div className="w-full rounded-full border-[1.5px] border-green-500/35 bg-green-100 p-[5px] shadow-[0_1px_2px_rgba(28,23,48,0.06)]">
      <div className="flex items-center">
        <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-green-700 text-[15px] font-bold text-white">
          »
        </span>
        <span className="flex-1 text-center font-display text-[15px] font-extrabold tracking-[-0.01em] text-green-700">
          Slide to go free
        </span>
        <span className="w-[38px] shrink-0" />
      </div>
    </div>
  )
}

/** PlanCard, as a friend sees it before joining. */
function MooveCardVisual() {
  return (
    <div className="w-full rounded-2xl border-[1.5px] border-[#E8E4F5] bg-white px-3 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-[46px] w-[46px] shrink-0 flex-col items-center justify-center gap-px rounded-[13px] bg-purple-100 px-0.5">
          <span className="font-display text-[13px] font-extrabold leading-none tracking-tight text-purple-700">SUN</span>
          <span className="font-sans text-[8.5px] font-bold leading-none tracking-[0.04em] text-purple-700/75">AUG 3</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-bold leading-tight tracking-tight text-ink-900">
            Tacos at Big Star
          </p>
          <p className="mt-0.5 truncate font-sans text-[12.5px] leading-snug text-ink-500">Sunday, no set time</p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="rounded-full bg-purple-100 px-1.5 py-0.5 font-sans text-[10.5px] font-bold text-purple-700">
              Maya
            </span>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-purple-500 px-3.5 py-2 font-sans text-[12.5px] font-bold text-white">
          I&apos;m in
        </span>
      </div>
      <div className="mt-2.5 flex items-center border-t border-grey-100 pt-2.5">
        <FaceStack names={['M', 'J']} />
        <span className="ml-2 font-sans text-[11.5px] font-semibold text-ink-500">2 in</span>
      </div>
    </div>
  )
}

/** PlanCard once you're in and the group text has unlocked. */
function JoinedMooveVisual() {
  return (
    <div className="w-full rounded-2xl border-[1.5px] border-[#E8E4F5] bg-white px-3 py-3 shadow-[0_8px_24px_rgba(28,23,48,0.10)]">
      <div className="flex items-center gap-3">
        <div className="flex h-[46px] w-[46px] shrink-0 flex-col items-center justify-center gap-px rounded-[13px] bg-purple-100 px-0.5">
          <span className="font-display text-[13px] font-extrabold leading-none tracking-tight text-purple-700">7:30</span>
          <span className="font-sans text-[8.5px] font-bold leading-none tracking-[0.04em] text-purple-700/75">PM</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-bold leading-tight tracking-tight text-ink-900">
            Pickup at the courts
          </p>
          <p className="mt-0.5 truncate font-sans text-[12.5px] leading-snug text-ink-500">Tonight 7:30 PM · Wicker Park</p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="rounded-full bg-purple-100 px-1.5 py-0.5 font-sans text-[10.5px] font-bold text-purple-700">
              Your Moove
            </span>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-green-700 px-3.5 py-2 font-sans text-[12.5px] font-bold text-white">
          You&apos;re in ✓
        </span>
      </div>
      <div className="mt-2.5 flex items-center border-t border-grey-100 pt-2.5">
        <FaceStack names={['A', 'J', 'R']} />
        <span className="ml-2 flex-1 font-sans text-[11.5px] font-semibold text-ink-500">4 in</span>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-grey-100 px-2.5 py-1.5">
          <BubbleIcon className="text-ink-500" />
          <span className="font-sans text-[12px] font-bold text-ink-500">3</span>
        </span>
      </div>
      <div className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-[13px] bg-purple-500 py-2.5 font-display text-[14px] font-extrabold tracking-tight text-white">
        <BubbleIcon className="text-white" />
        Start a group text
      </div>
    </div>
  )
}

/** SponsoredCard, before "I'm interested". */
function SponsoredCardVisual() {
  return (
    <div className="w-full overflow-hidden rounded-[20px] border border-[#E8E4F5] bg-white shadow-[0_8px_24px_rgba(28,23,48,0.10)]">
      <div className="p-4">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-grey-300">
          Sponsored · Logan Square Market
        </div>
        <div className="mb-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-2.5 py-1 text-[11px] font-bold text-purple-700">
            Markets &amp; pop-ups
          </span>
        </div>
        <div className="font-display text-[17px] font-extrabold leading-[1.2] tracking-[-0.01em] text-ink-900">
          Sunday Farmers Market
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-ink-500">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#6B628A" strokeWidth="2" />
            <path d="M12 7v5l3 2" stroke="#6B628A" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Sunday 9:00 AM · Logan Square
        </div>
        <p className="mt-2.5 font-sans text-[13px] leading-relaxed text-ink-500">
          Sixty-odd stalls under the blue line, coffee carts at the north end.
        </p>
        <div className="mt-3.5 flex h-[46px] w-full items-center justify-center rounded-full bg-purple-500 font-sans text-[15px] font-semibold text-white">
          I&apos;m interested
        </div>
      </div>
    </div>
  )
}

function FaceStack({ names }: { names: string[] }) {
  const bg = ['bg-purple-500', 'bg-[#E8A0B4]', 'bg-[#5FB0E8]']
  return (
    <div className="flex shrink-0">
      {names.map((n, i) => (
        <span
          key={n}
          className={`flex h-[23px] w-[23px] items-center justify-center rounded-full font-display text-[10px] font-bold text-white ring-2 ring-white ${bg[i % bg.length]} ${i > 0 ? '-ml-2' : ''}`}
        >
          {n}
        </span>
      ))}
    </div>
  )
}

function BubbleIcon({ className }: { className?: string }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}
