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
//
// R38 — three additions, from mooves-r38-onboarding-refresh.html:
//   · "Set the rest of your week?" beneath the chips opens the Phase 22 grid
//     inline and saves THIS week's slots through the same endpoint the ritual
//     sheet uses. Nothing carries over (Phase 22.0 stands), and having slots
//     this week is exactly what keeps the ritual sheet from auto-opening on the
//     first feed visit (FeedScreen already gates on `slots.length === 0`).
//   · The reveal shows the REAL traffic-light tile inside your green ring. That
//     is a deliberate one-screen exception to R24's light-or-face rule: it is
//     the moment the gesture is taught, so the control and its result sit
//     together.
//   · One line names the cow, because the reveal is the last thing the cold
//     path reads before the crew step.

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog'
import TimeChips from '@/components/go-green/TimeChips'
import GoGreenLight from '@/components/ui/GoGreenLight'
import WeekGrid, { type SlotKey } from '@/components/availability/WeekGrid'
import CowDisc from '@/components/onboarding/CowDisc'
import { COLD_STEPS, StepDots, StepEyebrow } from '@/components/onboarding/StepProgress'
import { computeExpiresAt, statusTimeLabel, type StatusTime } from '@/lib/greenExpiry'
import { toLocalDateStr, weekDates, type SlotPart } from '@/lib/availability'

const STEP = 2

function FreeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get('invite')

  const [step, setStep] = useState<'rehearse' | 'reveal'>('rehearse')
  const [time, setTime] = useState<StatusTime | null>(null)
  const [saving, setSaving] = useState(false)

  // R38 — "Set the rest of your week?"
  const [weekOpen, setWeekOpen] = useState(false)
  const [ritualDay, setRitualDay] = useState(1)
  const [slots, setSlots] = useState<Set<SlotKey>>(new Set())
  // Only a grid the user actually touched is saved. Opening the row and
  // closing it again is not an answer, and must not write an empty week.
  const [weekTouched, setWeekTouched] = useState(false)

  const next = inviteCode ? `/onboarding/invite?invite=${inviteCode}` : '/onboarding/invite'

  // The same week the feed's ritual check reads: weekDates(ritual day), with
  // the user's own ritual day (default Monday). Any slots already there (a
  // resumed onboarding) are shown, so a save never silently wipes them.
  const days = weekDates(ritualDay)
  const from = toLocalDateStr(days[0])
  const to = toLocalDateStr(days[6])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const meta = (await fetch('/api/availability').then(r => r.json())) as { weekRitualDay?: number }
        const day = meta.weekRitualDay ?? 1
        const week = weekDates(day)
        const res = (await fetch(
          `/api/availability?from=${toLocalDateStr(week[0])}&to=${toLocalDateStr(week[6])}`,
        ).then(r => r.json())) as { slots?: { date: string; part: string }[] }
        if (cancelled) return
        setRitualDay(day)
        setSlots(prev => (prev.size > 0 ? prev : new Set((res.slots ?? []).map(s => `${s.date}:${s.part}`))))
      } catch {
        // The row still works on the default week; a save simply replaces it.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function toggleSlot(dateStr: string, part: SlotPart) {
    setWeekTouched(true)
    setSlots(prev => {
      const nextSet = new Set(prev)
      const key = `${dateStr}:${part}`
      if (nextSet.has(key)) nextSet.delete(key)
      else nextSet.add(key)
      return nextSet
    })
  }

  // Same endpoint, same wholesale-replace semantics as WeekRitualSheet. Never
  // blocks onboarding: if it fails, the ritual sheet simply asks again on the
  // feed, which is the pre-R38 behaviour.
  async function saveWeek() {
    if (!weekTouched) return
    try {
      const body = [...slots].map(k => {
        const [date, part] = k.split(':')
        return { date, part }
      })
      const res = await fetch('/api/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, slots: body }),
      })
      if (res.ok) posthog.capture('onboarding_week_set', { slots: body.length })
    } catch {
      // non-blocking, see above
    }
  }

  async function goGreen() {
    if (saving) return
    if (!time) {
      // A week set without a chip is still an answer: save it and carry on.
      // There is no green, so there is nothing to reveal.
      if (!(weekTouched && slots.size > 0)) return
      setSaving(true)
      await saveWeek()
      router.push(next)
      return
    }
    setSaving(true)
    const week = saveWeek()
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
      await week
      setStep('reveal')
    } catch {
      // The rehearsal is not worth blocking onboarding over. Move them along;
      // they can go green from the rail in one tap.
      posthog.capture('onboarding_rehearsal_failed')
      await week
      router.push(next)
    } finally {
      setSaving(false)
    }
  }

  async function skip() {
    if (saving) return
    setSaving(true)
    posthog.capture('onboarding_rehearsal_skipped')
    // Ticked cells are kept even on a skip: "Skip" declines the green, and
    // throwing away a week somebody just set is the worse failure.
    await saveWeek()
    router.push(next)
  }

  const label = statusTimeLabel(time) ?? 'free'
  const canContinue = (!!time || (weekTouched && slots.size > 0)) && !saving

  if (step === 'reveal') {
    return (
      <div className="min-h-screen flex flex-col bg-purple-50">
        <div className="flex-1 flex flex-col px-6 pt-[calc(env(safe-area-inset-top)+3.5rem)]">
          <StepEyebrow index={STEP} count={COLD_STEPS} />
          <h1 className="font-display font-extrabold text-[25px] text-ink-900 tracking-[-0.025em] leading-[1.14]">
            You&apos;re free {label.toLowerCase()}.
            <br />
            Nobody can see it yet.
          </h1>
          <p className="font-sans text-[14px] text-ink-500 leading-relaxed mt-3">
            Mooves only does anything once your people are here. Right now it&apos;s just you.
          </p>

          {/* Your tile and three empty rings. The emptiness is the argument.
              The tile is the real GoGreenLight inside the rail's own ring
              (dashed because it is yours, at the "later" weight because
              onboarding never offers Now), so the thing you are told to tap
              is the thing you will see at the head of the rail. */}
          <div className="flex items-start gap-3.5 mt-8">
            <div className="flex flex-col items-center gap-1 w-[58px] shrink-0">
              <span className="relative block">
                <GoGreenLight size={54} />
                <span className="absolute -inset-1 rounded-full pointer-events-none border-[2.5px] border-dashed border-green-500/40" />
              </span>
              <span className="max-w-[58px] truncate font-sans text-[11px] font-bold text-ink-900">You</span>
              <span className="h-[13px] leading-[13px] font-sans text-[9.5px] font-bold uppercase tracking-[0.04em] text-ink-500">
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
          <p className="font-sans text-[14px] font-semibold text-ink-900 mt-3">
            Tap your light whenever you&apos;re around.
          </p>
          <div className="flex items-center gap-3 mt-[18px]">
            <CowDisc size={44} />
            <p className="font-sans text-[14px] font-semibold text-ink-900 leading-snug">
              Tap the cow to plan a Moove.
            </p>
          </div>
        </div>

        <div className="px-6 pb-[calc(env(safe-area-inset-bottom)+1.875rem)] pt-3.5">
          <StepDots index={STEP} count={COLD_STEPS} />
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
    <div className="h-dvh flex flex-col bg-purple-50">
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col px-6 pt-[calc(env(safe-area-inset-top)+3.5rem)] pb-2">
        <StepEyebrow index={STEP} count={COLD_STEPS} />
        <h1 className="font-display font-extrabold text-[25px] text-ink-900 tracking-[-0.025em] leading-[1.14]">
          When are you free
          <br />
          this week?
        </h1>
        <p className="font-sans text-[14px] text-ink-500 leading-relaxed mt-3 mb-7">
          Pick one. You can change it any time, and it only lasts as long as you say.
        </p>

        <TimeChips selected={time} onChange={setTime} hideNow />

        {/* R38 — optional and collapsed, so the one-tap path is unchanged. */}
        <div
          className={`mt-3.5 shrink-0 rounded-2xl border-[1.5px] bg-white overflow-hidden ${
            weekOpen ? 'border-purple-500' : 'border-[#E8E4F5]'
          }`}
        >
          <button
            type="button"
            aria-expanded={weekOpen}
            onClick={() => setWeekOpen(o => !o)}
            className="w-full flex items-center gap-3 px-3.5 py-3 text-left"
          >
            <span className="shrink-0 w-[34px] h-[34px] rounded-[10px] bg-purple-100 flex items-center justify-center text-purple-700">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-display font-extrabold text-[14.5px] tracking-[-0.01em] text-ink-900">
                Set the rest of your week?
              </span>
              <span className="block font-sans text-[12px] text-ink-500 mt-px">
                Pick the times you&apos;re free this week, if you know them.
              </span>
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-grey-300">
              <polyline points={weekOpen ? '6 15 12 9 18 15' : '6 9 12 15 18 9'} />
            </svg>
          </button>

          {weekOpen && (
            <div className="px-3 pb-3">
              {/* The privacy promise, as on the ritual sheet. */}
              <span className="mb-2.5 flex w-fit items-center gap-1.5 rounded-full bg-grey-100 py-1.5 pl-2 pr-2.5 font-sans text-[11px] font-semibold text-ink-500">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Only you can see this
              </span>
              <WeekGrid days={days} selected={slots} onToggle={toggleSlot} disabled={saving} />
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 px-6 pb-[calc(env(safe-area-inset-bottom)+1.875rem)] pt-3.5">
        <StepDots index={STEP} count={COLD_STEPS} />
        <button
          onClick={() => void goGreen()}
          disabled={!canContinue}
          className="w-full py-4 rounded-2xl bg-purple-500 text-white font-display font-extrabold text-[16px] tracking-[-0.02em] disabled:opacity-40"
        >
          {saving ? 'Saving…' : "That's when I'm free"}
        </button>
        <button
          onClick={() => void skip()}
          disabled={saving}
          className="block w-full text-center mt-3 font-sans text-[13.5px] font-medium text-ink-500 disabled:opacity-50"
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
