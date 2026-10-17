'use client'

// R37 + R38 — text alerts, the final onboarding step on both paths.
//
//   Cold path:    profile → free → crew → THIS (step 4 of 4)
//   Invited path: profile → THIS (step 2 of 2)
//
// The screen itself is TextAlertsOptIn (R37), the exact screen from the Twilio
// opt-in proof, so it is rendered as-is and never restyled here. This page only
// owns the ending: whichever answer comes back, onboarding is marked complete
// (awaited, so the feed never reads onboardingComplete=false and bounces back
// here) and the user lands on the feed. This is the ONLY place in the chain
// that writes onboardingComplete.
//
// Mockups: mooves-r37-text-alerts.html (states 1–3),
//          mooves-r38-onboarding-refresh.html (counters).

import { Suspense, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog'
import TextAlertsOptIn from '@/components/sms/TextAlertsOptIn'
import { COLD_STEPS, INVITED_STEPS } from '@/components/onboarding/StepProgress'

function AlertsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get('invite')
  const invited = searchParams.get('path') === 'invited'

  const stepCount = invited ? INVITED_STEPS : COLD_STEPS
  const stepIndex = stepCount
  // The invited path keeps its invite handling: a personal invite rides the
  // URL, group / roundup codes stay in sessionStorage for the feed to complete.
  const feedUrl = inviteCode ? `/feed?invite=${inviteCode}` : '/feed'

  const doneRef = useRef(false)

  // Already onboarded (back button, a stale tab): this step is not a place to
  // linger, and re-running it would write completion twice.
  useEffect(() => {
    fetch('/api/users/me')
      .then(r => (r.ok ? r.json() : null))
      .then((data: { onboardingComplete?: boolean } | null) => {
        if (data?.onboardingComplete && !doneRef.current) {
          doneRef.current = true
          router.replace(feedUrl)
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function finish(optedIn: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    try {
      await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingComplete: true }),
      })
    } catch {
      // Network blip: the feed routes back to /onboarding, whose resume logic
      // sends a named user straight on (invited → here, cold → free).
    }
    posthog.capture('onboarding_completed', {
      path: invited ? 'invited' : 'cold',
      text_alerts: optedIn,
    })
    router.replace(feedUrl)
  }

  return (
    <TextAlertsOptIn
      variant="onboarding"
      stepIndex={stepIndex}
      stepCount={stepCount}
      stepLabel={`Step ${stepIndex} of ${stepCount}`}
      onDone={(optedIn: boolean) => void finish(optedIn)}
    />
  )
}

export default function OnboardingAlertsPage() {
  return (
    <Suspense>
      <AlertsContent />
    </Suspense>
  )
}
