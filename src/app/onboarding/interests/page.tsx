'use client'

// Screen 3 (revised) — Interests step. Third of four setup steps
// (Profile → Area → Interests → Invite). Skippable. Persists the curated
// interest slugs to users.interests via the existing PATCH /api/users/me.
// Mockup: mooves-screen3-onboarding-loop.html

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog'
import InterestPicker from '@/components/discover/InterestPicker'

function InterestsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get('invite')

  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // Resume: prefill any interests already saved; bounce if further along or not started.
    fetch('/api/users/me')
      .then(r => r.json())
      .then((data: { onboardingComplete?: boolean; displayName?: string | null; interests?: string[] }) => {
        if (data.onboardingComplete) {
          router.replace(inviteCode ? `/feed?invite=${inviteCode}` : '/feed')
          return
        }
        if (!data.displayName) {
          router.replace(inviteCode ? `/onboarding?invite=${inviteCode}` : '/onboarding')
          return
        }
        if (data.interests?.length) setSelected(data.interests)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function goNext() {
    router.push(inviteCode ? `/onboarding/invite?invite=${inviteCode}` : '/onboarding/invite')
  }

  function handleSkip() {
    posthog.capture('onboarding_interests_skipped')
    goNext()
  }

  async function handleContinue() {
    if (busy) return
    // Continuing with nothing selected is equivalent to skipping.
    if (selected.length === 0) {
      handleSkip()
      return
    }
    setBusy(true)
    try {
      await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interests: selected }),
      })
      posthog.capture('onboarding_interests_set', { count: selected.length })
    } catch {
      // Non-blocking: interests are editable later in Settings.
    }
    goNext()
  }

  return (
    <main className="min-h-screen bg-surface-bg flex flex-col relative">
      <button
        onClick={handleSkip}
        className="absolute top-11 right-6 z-10 font-sans text-[13px] font-semibold text-text-secondary"
      >
        Skip for now
      </button>

      {/* Step dots — step 3 of 4 */}
      <div className="flex gap-1.5 justify-center pt-12">
        <div className="w-2 h-2 rounded-full bg-mooves-purple" />
        <div className="w-2 h-2 rounded-full bg-mooves-purple" />
        <div className="w-2 h-2 rounded-full bg-mooves-purple" />
        <div className="w-2 h-2 rounded-full bg-[#E8E4F5]" />
      </div>

      <div className="flex-1 flex flex-col items-center px-7 pt-9">
        <h1 className="font-display font-extrabold text-[26px] text-text-primary tracking-tight leading-[1.15] text-center mb-2 w-full">
          What are you<br />into?
        </h1>
        <p className="font-sans text-[15px] text-text-secondary leading-relaxed text-center mb-8 w-full">
          We&apos;ll match you with Mooves nearby. Change these anytime.
        </p>

        <InterestPicker selected={selected} onChange={setSelected} />

        <p className="font-sans text-[13px] text-text-secondary mt-5 text-center w-full">
          {selected.length === 0 ? 'Pick a few, or skip for now.' : `${selected.length} selected`}
        </p>
      </div>

      <div className="px-7 pb-11">
        <button
          onClick={() => void handleContinue()}
          disabled={busy}
          className="w-full py-[17px] rounded-2xl bg-mooves-purple text-white font-display font-extrabold text-[17px] tracking-tight disabled:opacity-40 transition-opacity"
        >
          Continue
        </button>
      </div>
    </main>
  )
}

export default function OnboardingInterestsPage() {
  return (
    <Suspense>
      <InterestsContent />
    </Suspense>
  )
}
