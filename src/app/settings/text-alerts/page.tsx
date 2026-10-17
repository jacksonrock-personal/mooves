'use client'

// R37 — Settings → Text alerts. Mockup: mooves-r37-text-alerts.html states 5–7.
// The proof's own header ("‹ Back · Text alerts"); the body, its off / on /
// stopped states and the turn-off confirm live in TextAlertsOptIn, which the
// onboarding step shares so the two asks can never drift apart.

import { useRouter } from 'next/navigation'
import TextAlertsOptIn from '@/components/sms/TextAlertsOptIn'

export default function TextAlertsSettingsPage() {
  const router = useRouter()

  function back() {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.replace('/settings')
  }

  return (
    <div className="flex min-h-screen flex-col bg-purple-50">
      <header className="flex shrink-0 items-center border-b border-[#E8E4F5] bg-white px-4 pb-3 [--safe-pt-base:0.75rem] safe-area-pt">
        <button
          onClick={back}
          className="flex w-16 items-center gap-[5px] font-sans text-[15px] font-medium text-purple-500"
        >
          <svg width="11" height="18" viewBox="0 0 11 18" fill="none" stroke="#7C5CDB" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 2 2 9 9 16" />
          </svg>
          Back
        </button>
        <h1 className="flex-1 text-center font-display text-[16px] font-extrabold tracking-[-0.01em] text-ink-900">
          Text alerts
        </h1>
        <span className="w-16" />
      </header>

      <TextAlertsOptIn variant="settings" onDone={() => {}} />
    </div>
  )
}
