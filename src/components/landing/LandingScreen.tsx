// Phase 25 — Landing page (makemooves.app), rebuilt.
//
// The page it replaces sold correctly and read like software. Five sections, a
// dark "why we're different" slab, and forty-odd sentences of benefit copy, all
// of it claiming a relaxed product in a tense layout. This one performs the
// promise instead of asserting it: ONE flat colour field with no section break,
// three beats of one sentence each, and the UI held inside handmade artifacts
// rather than floating in feature cards.
//
// Reference and mockup: mooves-phase25-landing.html (modelled on the structure
// of outernetexplorer.com — thesis gag, three beats, manifesto, quiet footer).
//
// FOUR RULES THIS FILE IS UNDER, all of them from review and all of them easy to
// undo by accident:
//
//   1. NO DARK BAND. The one flat field is the whole visual argument. A section
//      with its own background is the thing that made the old page feel tense.
//   2. NO EM DASHES, anywhere in visitor-facing copy. Commas, colons, or a new
//      sentence.
//   3. SENTENCE CASE. The lowercase register belongs to the page we modelled
//      this on, not to us.
//   4. THREE BEATS. Every future addition wants to be a fourth. The brevity is
//      load-bearing; a fourth beat is a rewrite decision, not an edit.
//
// The card visuals below are STATIC REPLICAS of the real in-app surfaces, not
// the components themselves — those need a live plan, handlers and a session.
// When a card's design changes, these need the same edit; that's the deliberate
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
      {/* px-5 on phones, not px-7: the nav carries two pills and a wordmark on
          one row, and at 375px the 28px gutters pushed the Sponsor Portal pill
          off the right edge. Measured, not guessed. */}
      <div className="mx-auto max-w-[1000px] px-5 sm:px-7">
        {/* NAV */}
        <nav className="flex items-center justify-between gap-3 py-5">
          <div className="flex items-center gap-[9px]">
            <div className="flex h-[38px] w-[38px] items-center justify-center overflow-hidden rounded-[11px] bg-white shadow-[0_1px_2px_rgba(28,23,48,0.06)]">
              <CowMark size={30} />
            </div>
            {/* Below 385px the wordmark is dropped and the cow carries the
                brand alone. Measured: at 320 the row overflowed by 47px and
                scrolled the whole page sideways, and at 375 it fit with exactly
                zero slack, which is not a fit so much as a fit until a font
                loads differently. 385 is the first width with real slack, and
                it keeps the wordmark on a 393pt iPhone. Nothing is hidden here
                except the word itself. */}
            <span className="font-display text-[17px] font-extrabold tracking-[-0.02em] text-ink-900 max-[384px]:hidden sm:text-[20px]">
              Mooves
            </span>
          </div>
          {/* flex-nowrap on purpose: with two buttons up here, wrapping drops
              Sponsor Portal onto its own line under Open app and the two stop
              reading as a pair. The paddings shrink instead. */}
          {/* The two traded both slot and fill. Open app is the page's job, so
              it is the filled one; Sponsor Portal is a real door but a B2B one,
              and a solid purple pill for it out-shouted the consumer CTA it
              sits beside. */}
          <div className="flex flex-nowrap items-center gap-[7px] sm:gap-[9px]">
            <Link
              href="/auth"
              onClick={() => onCta('nav')}
              className="whitespace-nowrap rounded-full border-[1.5px] border-purple-500 bg-purple-500 px-[11px] py-[9px] text-[12.5px] font-semibold text-white sm:px-[17px] sm:py-[11px] sm:text-[14px]"
            >
              Open app
            </Link>
            <a
              href="https://makemooves.app/sponsor"
              onClick={() => onCta('nav_sponsor')}
              className="whitespace-nowrap rounded-full border-[1.5px] border-purple-100 bg-white px-[11px] py-[9px] text-[12.5px] font-semibold text-purple-500 sm:px-[17px] sm:py-[11px] sm:text-[14px]"
            >
              Sponsor Portal
            </a>
          </div>
        </nav>

        {/* HERO
            The thesis is a gag, not a claim: the sentence the visitor already
            sends their friends, struck through, with the app underneath. The
            old hero opened with "The easiest way to actually hang out", which
            is a sentence every app in this category can write. */}
        <header className="relative px-0 pb-16 pt-6 text-center">
          <Stamp className="left-[2%] top-5 -rotate-[13deg] border-green-700 text-green-700">Logan Square</Stamp>
          <Stamp className="right-[1%] top-[74px] rotate-[9deg] border-green-700 text-green-700">Bushwick</Stamp>
          <Stamp className="bottom-[34px] left-[6%] rotate-[6deg] border-purple-700 text-purple-700">Thursday, 7pm</Stamp>
          <Stamp className="bottom-3 right-[5%] -rotate-[7deg] border-purple-700 text-purple-700">Nobody rsvp&apos;d</Stamp>

          <span className="relative inline-block font-display text-[19px] font-bold tracking-[-0.02em] text-grey-300 sm:text-[23px] md:text-[27px]">
            We should hang out sometime
            {/* The strike is an element, not a text-decoration: it has to be
                purple, 3px and slightly off-horizontal to read as drawn on. */}
            <span className="pointer-events-none absolute -left-1.5 -right-1.5 top-[56%] h-[3px] -rotate-[1.4deg] rounded-full bg-purple-500" />
          </span>

          {/* Four steps rather than two, tracking the mockup's
              clamp(44px, 7.8vw, 86px). Two steps put 86px on a 768px screen,
              which is the size the mockup only reaches past 1100px. */}
          <h1 className="mt-3 font-display text-[44px] font-extrabold leading-[1.04] tracking-[-0.03em] text-ink-900 sm:text-[52px] md:text-[62px] lg:text-[80px] xl:text-[86px]">
            Make it easier to hang out.
          </h1>
          <p className="mx-auto mt-[22px] max-w-[460px] text-[17.5px] font-medium leading-[1.5] text-ink-500">
            Go green when you&apos;re free. Your friends see it, and now they know they can just ask you.
          </p>

          <div className="mt-[30px] flex flex-wrap justify-center gap-3">
            <GreenPill href="/auth" onClick={() => onCta('hero')} />
            <a
              href="#beats"
              className="inline-flex items-center rounded-full bg-purple-100 px-8 py-[17px] font-display text-[17px] font-extrabold tracking-[-0.01em] text-purple-700"
            >
              See how it works
            </a>
          </div>
          <p className="mt-3.5 text-[13.5px] text-ink-500">Free. Works in your browser. About a minute to set up.</p>
        </header>

        {/* BEAT 1 */}
        <section id="beats" className="flex flex-col items-center gap-8 py-10 text-center md:flex-row md:gap-14 md:py-[52px] md:text-left">
          <div className="flex-1">
            <h2 className="font-display text-[27px] font-extrabold leading-[1.04] tracking-[-0.03em] text-ink-900 md:text-[37px]">
              Casually go green when you&apos;re around and want to hang
            </h2>
            <p className="mx-auto mt-3.5 max-w-[410px] text-[16.5px] leading-[1.55] text-ink-500 md:mx-0">
              Your friends see a green ring. That&apos;s the whole feature. No status, no essay, no plan, and it
              expires on its own.
            </p>
          </div>
          <div className="flex w-full shrink-0 justify-center md:w-[366px]">
            <Polaroid caption="Green means I’m around">
              <RailVisual />
            </Polaroid>
          </div>
        </section>

        <Doodle direction="right" />

        {/* BEAT 2 */}
        <section className="flex flex-col items-center gap-8 py-10 text-center md:flex-row-reverse md:gap-14 md:py-[52px] md:text-left">
          <div className="flex-1">
            <h2 className="font-display text-[27px] font-extrabold leading-[1.04] tracking-[-0.03em] text-ink-900 md:text-[37px]">
              Or just say the thing you want to do
            </h2>
            <p className="mx-auto mt-3.5 max-w-[410px] text-[16.5px] leading-[1.55] text-ink-500 md:mx-0">
              &ldquo;Tacos, Sunday&rdquo; is a complete Moove. Time and place are optional. You pick who sees it:
              everyone, one group, or two specific people.
            </p>
          </div>
          <div className="flex w-full shrink-0 justify-center md:w-[366px]">
            <Polaroid tilt="right" caption="Nine words, one tap">
              <MooveCardVisual />
            </Polaroid>
          </div>
        </section>

        <Doodle direction="left" />

        {/* BEAT 3 */}
        <section className="flex flex-col items-center gap-8 py-10 text-center md:flex-row md:gap-14 md:py-[52px] md:text-left">
          <div className="flex-1">
            <h2 className="font-display text-[27px] font-extrabold leading-[1.04] tracking-[-0.03em] text-ink-900 md:text-[37px]">
              See who&apos;s interested and then get back in the group chat
            </h2>
            <p className="mx-auto mt-3.5 max-w-[410px] text-[16.5px] leading-[1.55] text-ink-500 md:mx-0">
              Once two people are in, one tap opens a text with exactly them. The plan happens where it always
              happened.
            </p>
          </div>
          <div className="flex w-full shrink-0 justify-center md:w-[366px]">
            <Polaroid caption="And then we close the app">
              <JoinedMooveVisual />
            </Polaroid>
          </div>
        </section>

        {/* MANIFESTO — this is where the old page put a third feature card.
            The page has to say why it exists somewhere, and a feature grid is
            not that. */}
        <section className="mx-auto max-w-[700px] px-0 pb-2 pt-[60px] text-center">
          <p className="font-display text-[21px] font-bold leading-[1.32] tracking-[-0.02em] text-ink-900 md:text-[27px]">
            We are all just one text message away from a great night. Mooves exists to make sure you send it.{' '}
            <b className="font-extrabold text-purple-700">Open the app for nine seconds and make the plan.</b>
          </p>
          <div className="mt-[30px] flex justify-center">
            <GreenPill href="/auth" onClick={() => onCta('closing')} />
          </div>
          {/* The line outernetexplorer.com never has to write. Their product is
              useful alone; ours is worth nothing until two friends are on it.
              Saying so costs a few signups and keeps the ones who stay. */}
          <p className="mt-3.5 text-[13.5px] text-ink-500">
            Bring two friends and it works. Bring none and it can&apos;t, so get your friends in the app asap.
          </p>
        </section>

        {/* SPONSOR INVITE — deliberately quiet and near the bottom. A paid
            listing is a real part of the product, but it is not what a visitor
            came here to read. */}
        <div className="mt-14 max-w-[520px] border-t border-[#E8E4F5] pb-2.5 pt-14">
          <h3 className="font-display text-[16px] font-extrabold tracking-[-0.01em] text-ink-900">
            Run a bar, a studio, a run club?
          </h3>
          <p className="mt-[7px] text-[14px] leading-[1.6] text-ink-500">
            Local spots and events can get listed on Mooves so people can turn your thing into a plan with their
            friends.{' '}
            <a
              href="mailto:business@makemooves.app"
              onClick={() => onCta('sponsor_mailto')}
              className="font-semibold text-purple-700"
            >
              Talk to us
            </a>
            .
          </p>
        </div>

        <div className="max-w-[640px] pb-1.5 pt-8">
          <p className="text-[15px] leading-[1.65] text-ink-500">
            Made by <b className="font-bold text-ink-900">friends in Chicago</b> who wanted an app where they could
            broadcast to the world that they wanted to be invited to a house party on weekends they were free.
          </p>
        </div>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#E8E4F5] pb-8 pt-[22px] text-[12.5px] text-ink-500">
          <span>© 2026 Mooves · makemooves.app</span>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href="/privacy" className="hover:text-ink-900">Privacy</Link>
            <Link href="/terms" className="hover:text-ink-900">Terms</Link>
            <a href="mailto:support@makemooves.app" className="hover:text-ink-900">Support</a>
          </span>
        </footer>
      </div>
    </div>
  )
}

/* ── page furniture ───────────────────────────────────────────────────────── */

/**
 * The one CTA, in both places it appears. Green-500 is DECORATIVE ONLY in the
 * design system — white on it is 2.1:1 — so the label is ink-900, which is also
 * why the pill reads as a green sticker rather than as a button that happens to
 * be green. Making the label white would mean dropping to green-700, and a dark
 * forest pill no longer says "this is the green".
 */
function GreenPill({ href, onClick }: { href: string; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="inline-flex items-center gap-2.5 rounded-full bg-green-500 px-8 py-[17px] font-display text-[17px] font-extrabold tracking-[-0.01em] text-ink-900"
    >
      <span className="h-[11px] w-[11px] rounded-full bg-white shadow-[0_0_0_3px_rgba(255,255,255,0.45)]" />
      Go green
    </Link>
  )
}

/** Rubber stamps in the hero: neighbourhoods and times, not passport cities. */
function Stamp({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span
      className={`pointer-events-none absolute hidden whitespace-nowrap rounded-[10px] border-[2.5px] px-[11px] py-[7px] font-display text-[11px] font-extrabold uppercase leading-none tracking-[0.14em] opacity-[0.34] lg:inline-block ${className}`}
    >
      {children}
    </span>
  )
}

/**
 * The artifact that holds every UI replica. Without it the screenshots float in
 * white space and the page is a feature grid again; inside it, the same pixels
 * read as something a person put on a fridge.
 */
function Polaroid({
  children,
  caption,
  tilt = 'left',
}: {
  children: React.ReactNode
  caption: string
  tilt?: 'left' | 'right'
}) {
  return (
    <div
      // max-w-full is load-bearing, not defensive. The replicas inside are a
      // fixed 326px so the in-app proportions survive, which at 320px made the
      // frame 354px wide and scrolled the whole page sideways. Capped, the
      // frame shrinks and the rail replica clips its last tile against its own
      // overflow-hidden, which is what the real rail does anyway.
      className={`relative max-w-full rounded-[4px] bg-white p-[11px] pb-10 shadow-[0_12px_34px_rgba(28,23,48,0.16)] ${
        tilt === 'right' ? 'rotate-[1.8deg]' : '-rotate-[2.2deg]'
      }`}
    >
      <span className="absolute -top-[11px] left-1/2 h-[22px] w-[74px] -translate-x-1/2 -rotate-[2deg] rounded-sm bg-purple-500/20" />
      {children}
      <span className="absolute inset-x-0 bottom-3 text-center font-display text-[13px] font-bold tracking-[-0.01em] text-ink-500">
        {caption}
      </span>
    </div>
  )
}

/** A dotted hand-drawn arrow between beats. Hidden on mobile, where the beats stack. */
function Doodle({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      width="80"
      height="42"
      viewBox="0 0 80 42"
      fill="none"
      aria-hidden
      className="mx-auto hidden opacity-50 md:block"
    >
      {direction === 'right' ? (
        <>
          <path d="M6 5c14 26 44 32 66 12" stroke="#BDB5D4" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="1 7" />
          <path d="M64 10l9 8-11 4" stroke="#BDB5D4" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <path d="M74 5C60 31 30 37 8 17" stroke="#BDB5D4" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="1 7" />
          <path d="M16 9L7 17l11 4" stroke="#BDB5D4" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  )
}

/* ── Static replicas of real in-app surfaces ──────────────────────────────────
   Marketing screenshots that can't go stale silently — they're built from the
   same tokens as the components they mirror, so a token change moves both. */

/** The rail at rest (R21/R22): you and whoever is free, then everybody else. */
function RailVisual() {
  const people: { initial: string; name: string; tone: string; when: string | null }[] = [
    { initial: 'Y', name: 'You', tone: 'bg-purple-500', when: 'Now' },
    { initial: 'D', name: 'Dana', tone: 'bg-[#E8A0B4]', when: 'Now' },
    { initial: 'J', name: 'Jonah', tone: 'bg-[#5FB0E8]', when: null },
    { initial: 'S', name: 'Sam', tone: 'bg-[#CEAD6A]', when: null },
    { initial: 'A', name: 'Ana', tone: 'bg-[#63C6A8]', when: null },
  ]
  return (
    <div className="flex w-[326px] max-w-full gap-3 overflow-hidden rounded-[3px] bg-purple-50 px-3 py-4">
      {people.map(p => (
        <div key={p.initial} className="flex w-[56px] shrink-0 flex-col items-center gap-[5px]">
          <span className="relative">
            <span
              className={`flex h-[50px] w-[50px] items-center justify-center rounded-full ${p.tone} font-display text-[17px] font-extrabold text-white ${
                p.when ? '' : 'grayscale opacity-[0.48]'
              }`}
            >
              {p.initial}
            </span>
            <span
              className={`absolute -inset-1 rounded-full ${
                p.when ? 'border-[2.5px] border-green-500' : 'border-[1.25px] border-grey-300'
              }`}
            />
          </span>
          <span className="text-[11px] font-semibold text-ink-500">{p.name}</span>
          <span className="h-3 text-[9px] font-extrabold uppercase leading-3 tracking-[0.05em] text-green-700">
            {p.when ?? ''}
          </span>
        </div>
      ))}
    </div>
  )
}

/** PlanCard, as a friend sees it before joining. */
function MooveCardVisual() {
  return (
    <div className="w-[326px] max-w-full rounded-2xl border-[1.5px] border-[#E8E4F5] bg-white p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-[46px] w-[46px] shrink-0 flex-col items-center justify-center gap-px rounded-[13px] bg-purple-100 px-0.5">
          <span className="font-display text-[13px] font-extrabold leading-none tracking-[-0.02em] text-purple-700">SUN</span>
          <span className="text-[8.5px] font-extrabold leading-none tracking-[0.04em] text-purple-700/75">AUG 3</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-extrabold tracking-[-0.02em] text-ink-900">
            Tacos at Big Star
          </p>
          <p className="mt-0.5 truncate text-[12.5px] text-ink-500">Sunday, no set time</p>
        </div>
        <span className="shrink-0 rounded-full bg-purple-500 px-3.5 py-2 text-[12.5px] font-bold text-white">
          I&apos;m in
        </span>
      </div>
      <div className="mt-2.5 flex items-center gap-2 border-t border-grey-100 pt-2.5">
        <FaceStack names={['M', 'J']} />
        <span className="text-[11.5px] font-semibold text-ink-500">2 in</span>
      </div>
    </div>
  )
}

/** PlanCard once you're in and the group text has unlocked. */
function JoinedMooveVisual() {
  return (
    <div className="w-[326px] max-w-full rounded-2xl border-[1.5px] border-[#E8E4F5] bg-white p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-[46px] w-[46px] shrink-0 flex-col items-center justify-center gap-px rounded-[13px] bg-purple-100 px-0.5">
          <span className="font-display text-[13px] font-extrabold leading-none tracking-[-0.02em] text-purple-700">7:30</span>
          <span className="text-[8.5px] font-extrabold leading-none tracking-[0.04em] text-purple-700/75">PM</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-extrabold tracking-[-0.02em] text-ink-900">
            Pickup at the courts
          </p>
          <p className="mt-0.5 truncate text-[12.5px] text-ink-500">Tonight, Wicker Park</p>
        </div>
        <span className="shrink-0 rounded-full bg-green-700 px-3.5 py-2 text-[12.5px] font-bold text-white">
          You&apos;re in ✓
        </span>
      </div>
      <div className="mt-2.5 flex items-center gap-2 border-t border-grey-100 pt-2.5">
        <FaceStack names={['A', 'J', 'R']} />
        <span className="text-[11.5px] font-semibold text-ink-500">4 in</span>
      </div>
      <div className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-[13px] bg-purple-500 py-[11px] font-display text-[14px] font-extrabold tracking-[-0.01em] text-white">
        <BubbleIcon className="text-white" />
        Start a group text
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
          className={`flex h-[22px] w-[22px] items-center justify-center rounded-full font-display text-[10px] font-extrabold text-white ring-2 ring-white ${bg[i % bg.length]} ${
            i > 0 ? '-ml-[7px]' : ''
          }`}
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
