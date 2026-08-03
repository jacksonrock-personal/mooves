'use client'

// Screen 3, step 2 (Phase 24.2) — the rehearsal, and the reveal.
//
// This replaces MoovesLoop's place in the onboarding chain. The explainer was
// three cards describing availability; this is one real green. You cannot teach
// the loop faster than by running it, and the thing that makes the NEXT step
// convert is not an argument, it is the moment the green turns out to be
// invisible.
//
//   rehearse → a real green, with real expiry. Not a demo.
//   reveal   → "You're free Thursday. Nobody can see it yet."
//
// The reveal is why the green has to be real. A fake one would make the empty
// rail a graphic; a real one makes it a problem the user just created and can
// immediately fix, which is what the crew step is for.
//
// "Now" is suppressed here and only here (24.5). A day-one green that dies in
// four hours, before anyone has been invited, teaches exactly the wrong lesson.
//
// MoovesLoop is NOT deleted — Settings still replays it (?replay=1). It is
// retired from this chain, not from the app.

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog'
import TimeChips from '@/components/go-green/TimeChips'
import { computeExpiresAt, statusTimeLabel, type StatusTime } from '@/lib/greenExpiry'

function FreeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get('invite')

  const [step, setStep] = useState<'rehearse' | 'reveal'>('rehearse')
  const [time, setTime] = useState<StatusTime | null>(null)
  const [saving, setSaving] = useState(false)

  const next = inviteCode ? `/onboarding/invite?invite=${inviteCode}` : '/onboarding/invite'

  async function goGreen() {
    if (!time || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isAvailable: true,
          statusNote: null,
          statusTime: time,
          visibleTo: null,
          visibleUserIds: null,
          statusMoveId: null,
          // Same local-clock expiry every other green uses (9.5 Part A).
          statusExpiresAt: computeExpiresAt(time).toISOString(),
          statusShowGroups: false,
        }),
      })
      if (!res.ok) throw new Error('failed')
      posthog.capture('onboarding_rehearsal_green', { time })
      setStep('reveal')
    } catch {
      // The rehearsal is not worth blocking onboarding over. Move them along;
      // they can go green from the rail in one tap.
      posthog.capture('onboarding_rehearsal_failed')
      router.push(next)
    } finally {
      setSaving(false)
    }
  }

  const label = statusTimeLabel(time) ?? 'free'

  if (step === 'reveal') {
    return (
      <div className="min-h-screen flex flex-col bg-purple-50">
        <div className="flex-1 flex flex-col px-6 pt-[calc(env(safe-area-inset-top)+3.5rem)]">
          <p className="font-sans text-[11.5px] font-bold uppercase tracking-[0.12em] text-purple-500 mb-3">
            Step 2 of 3
          </p>
          <h1 className="font-display font-extrabold text-[25px] text-ink-900 tracking-[-0.025em] leading-[1.14]">
            You&apos;re free {label.toLowerCase()}.
            <br />
            Nobody can see it yet.
          </h1>
          <p className="font-sans text-[14px] text-ink-500 leading-relaxed mt-3">
            Mooves only does anything once your people are here. Right now it&apos;s just you.
          </p>

          {/* One green tile and three empty rings. The emptiness is the
              argument, so no cow here: the character would soften a moment
              that should land flat. */}
          <div className="flex items-start gap-3.5 mt-8 mb-1.5">
            <div className="flex flex-col items-center gap-1 w-[58px]">
              <span className="relative block">
                <span className="w-[54px] h-[54px] rounded-full bg-purple-700 flex items-center justify-center font-display font-extrabold text-[19px] text-white">
                  You
                </span>
                <span className="absolute -inset-1 rounded-full border-[2.5px] border-dashed border-green-500" />
              </span>
              <span className="font-sans text-[9.5px] font-bold uppercase tracking-[0.04em] text-green-700">
                {label}
              </span>
            </div>
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="shrink-0 w-[54px] h-[54px] rounded-full border-[1.5px] border-dashed border-grey-300 opacity-55"
              />
            ))}
          </div>
          <p className="font-sans text-[11.5px] text-grey-300">
            Three empty spots, and one of them is doing all the work.
          </p>
        </div>

        <div className="px-6 pb-[calc(env(safe-area-inset-bottom)+1.875rem)] pt-3.5">
          <div className="flex gap-1.5 justify-center pb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-grey-300" />
            <span className="w-[18px] h-1.5 rounded-full bg-purple-500" />
            <span className="w-1.5 h-1.5 rounded-full bg-grey-300" />
          </div>
          <button
            onClick={() => {
              posthog.capture('onboarding_reveal_continued')
              router.push(next)
            }}
            className="w-full py-4 rounded-2xl bg-purple-500 text-white font-display font-extrabold text-[16px] tracking-[-0.02em]"
          >
            Create your Group
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-purple-50">
      <div className="flex-1 flex flex-col px-6 pt-[calc(env(safe-area-inset-top)+3.5rem)]">
        <p className="font-sans text-[11.5px] font-bold uppercase tracking-[0.12em] text-purple-500 mb-3">
          Step 2 of 3
        </p>
        <h1 className="font-display font-extrabold text-[25px] text-ink-900 tracking-[-0.025em] leading-[1.14]">
          When are you free
          <br />
          this week?
        </h1>
        <p className="font-sans text-[14px] text-ink-500 leading-relaxed mt-3 mb-7">
          Pick one. You can change it any time, and it only lasts as long as you say.
        </p>

        <TimeChips selected={time} onChange={setTime} hideNow />
      </div>

      <div className="px-6 pb-[calc(env(safe-area-inset-bottom)+1.875rem)] pt-3.5">
        <div className="flex gap-1.5 justify-center pb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-grey-300" />
          <span className="w-[18px] h-1.5 rounded-full bg-purple-500" />
          <span className="w-1.5 h-1.5 rounded-full bg-grey-300" />
        </div>
        <button
          onClick={() => void goGreen()}
          disabled={!time || saving}
          className="w-full py-4 rounded-2xl bg-purple-500 text-white font-display font-extrabold text-[16px] tracking-[-0.02em] disabled:opacity-40"
        >
          {saving ? 'Saving…' : "That's when I'm free"}
        </button>
        <button
          onClick={() => {
            posthog.capture('onboarding_rehearsal_skipped')
            router.push(next)
          }}
          className="block w-full text-center mt-3 font-sans text-[13.5px] font-medium text-ink-500"
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}

export default function OnboardingFreePage() {
  return (
    <Suspense>
      <FreeContent />
    </Suspense>
  )
}
