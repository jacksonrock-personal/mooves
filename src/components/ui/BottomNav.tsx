'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import CowMark from './CowMark'
import { posthog } from '@/lib/posthog'

function HomeIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function DiscoverIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5 5-2Z" />
    </svg>
  )
}

function PeopleIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

// R1 — five slots. "Plan a Moove" sits in the middle, Venmo-style, because the
// floating "+" covered feed content (it sat on top of the roster row and the
// comment control of the card beneath it) and never said what it did.
const LEFT_TABS = [
  { href: '/feed', label: 'Feed', Icon: HomeIcon },
  { href: '/discover', label: 'Discover', Icon: DiscoverIcon },
]
const RIGHT_TABS = [
  { href: '/people', label: 'People', Icon: PeopleIcon },
  { href: '/settings', label: 'Settings', Icon: SettingsIcon },
]

interface BottomNavProps {
  /**
   * Supplied by the Feed, which owns the composer and can open it in place.
   * Everywhere else the button routes to /feed?compose=1 — posting a Moove
   * should land you where the Moove appears.
   */
  onPlanTap?: () => void
}

export default function BottomNav({ onPlanTap }: BottomNavProps = {}) {
  const pathname = usePathname()
  const router = useRouter()

  function tab({ href, label, Icon }: (typeof LEFT_TABS)[number]) {
    const active = pathname.startsWith(href)
    return (
      <Link
        key={href}
        href={href}
        className={`flex-1 flex flex-col items-center py-3 gap-1 text-[9.5px] font-sans font-semibold tracking-[0.02em] ${
          active ? 'text-mooves-purple' : 'text-status-grey'
        }`}
      >
        <Icon />
        <span>{label}</span>
      </Link>
    )
  }

  function handlePlan() {
    posthog.capture('nav_plan_tapped', { from: pathname })
    if (onPlanTap) onPlanTap()
    else router.push('/feed?compose=1')
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E8E4F5] flex pb-[env(safe-area-inset-bottom)] z-30">
      {LEFT_TABS.map(tab)}

      {/* Not a tab: no href, no active state. It opens a sheet and leaves you
          where you were, and a nav item that lights up on the same page is a
          small lie. The cow says whose button it is; the "+" says what it does. */}
      <button
        type="button"
        onClick={handlePlan}
        aria-label="Plan a Moove"
        className="flex-1 relative flex flex-col items-center justify-end py-3 gap-1 text-[9.5px] font-sans font-bold tracking-[0.02em] text-mooves-purple"
      >
        <span className="absolute -top-[19px] w-[52px] h-[52px] rounded-full bg-mooves-purple border-4 border-white shadow-[0_6px_16px_rgba(124,92,219,0.42)] flex items-center justify-center">
          <CowMark size={34} />
          <span className="absolute -right-[3px] -bottom-[3px] w-[21px] h-[21px] rounded-full bg-white border-[2.5px] border-white flex items-center justify-center">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#7C5CDB" strokeWidth="3.6" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
        </span>
        <span className="mt-[34px] whitespace-nowrap">Plan a Moove</span>
      </button>

      {RIGHT_TABS.map(tab)}
    </nav>
  )
}
