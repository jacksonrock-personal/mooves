'use client'

// R37 — Text alerts opt-in. Mockup: mooves-r37-text-alerts.html.
//
// ⚠ THE COPY IS A COMPLIANCE CONTRACT. Headline, lead, field label, checkbox
// label, disclosure and button are docs/compliance/sms-optin.html word for
// word: that is the proof Twilio reviewed for toll-free verification, and
// reviewers compare the live screens against it. Change one word here and the
// proof (and SMS_CONSENT_VERSION) must change with it.
//
// Two asks, never a nag: the final onboarding step and Settings → Text alerts.
// The box is NEVER pre-checked, and the button stays disabled until the person
// checks it themselves.
//
//   variant 'onboarding' — free/page.tsx geometry: eyebrow, headline, the proof
//     body, then dots + "Yes, sign me up" + a quiet "Not now" pinned at the
//     bottom. onDone(true) after a successful opt-in, onDone(false) on Not now.
//   variant 'settings'   — the page supplies the header. Renders off, on and
//     stopped-by-STOP, with a native-style confirm before turning off.
//     onDone(true) after opting in, onDone(false) after turning off.

import { useCallback, useEffect, useState } from 'react'
import { initPostHog, posthog } from '@/lib/posthog'
import { SMS_CONSENT_VERSION } from '@/lib/smsCopy'

export interface TextAlertsOptInProps {
  variant: 'onboarding' | 'settings'
  /** Overrides the eyebrow text. Defaults to "Step {stepIndex} of {stepCount}". */
  stepLabel?: string
  /** 1-based: the step this screen is ("Step 4 of 4" → stepIndex 4). */
  stepIndex?: number
  stepCount?: number
  onDone: (optedIn: boolean) => void
}

type Status = 'off' | 'on' | 'stopped'

// ── The proof, verbatim ──────────────────────────────────────────────────────
const HEADLINE = 'Get a text when friends make a Moove'
const LEAD = "When a friend makes a Moove you can see, we'll text you its name, time and a link to it."
const FIELD_LABEL = 'Mobile number'
const BOX_LABEL = 'Yes, text me when friends make a Moove'
const CTA = 'Yes, sign me up'

function Disclosure() {
  return (
    <p className="mt-3 font-sans text-[12px] leading-[1.52] text-ink-500">
      By checking this box you agree to receive recurring automated text alerts from Mooves at the
      number above. Msg frequency varies, up to 5 msgs/day. Msg &amp; data rates may apply. Reply
      HELP for help, STOP to cancel. Consent is not a condition of using Mooves. See our{' '}
      <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-purple-500 underline">
        Terms of Service
      </a>{' '}
      (makemooves.app/terms) and{' '}
      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-purple-500 underline">
        Privacy Policy
      </a>{' '}
      (makemooves.app/privacy).
    </p>
  )
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5L20 7" />
    </svg>
  )
}

/** Lead, optional stopped notice, the read-only number, the box, the disclosure. */
function ProofBody({
  phone,
  checked,
  onToggle,
  stopped,
}: {
  phone: string
  checked: boolean
  onToggle: () => void
  stopped: boolean
}) {
  return (
    <>
      <p className="mt-2.5 font-sans text-[14px] leading-[1.5] text-ink-500">{LEAD}</p>

      {stopped && (
        // Calm purple, not an error: they did this on purpose.
        <div className="mt-3.5 flex gap-2.5 rounded-2xl bg-purple-100 px-[13px] py-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5F3FC4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="11" x2="12" y2="16.5" />
            <circle cx="12" cy="7.6" r=".6" fill="#5F3FC4" />
          </svg>
          <p className="font-sans text-[12.5px] font-medium leading-[1.5] text-purple-700">
            You turned these off by replying STOP. To get them again, text START to the Mooves number.
          </p>
        </div>
      )}

      <label
        htmlFor="text-alerts-phone"
        className="mb-1.5 mt-4 block font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500"
      >
        {FIELD_LABEL}
      </label>
      <input
        id="text-alerts-phone"
        type="tel"
        readOnly
        value={phone}
        className="w-full rounded-xl border-[1.5px] border-[#E8E4F5] bg-white px-3.5 py-3 font-sans text-[16px] text-ink-900 outline-none"
      />

      {!stopped && (
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={onToggle}
        className="mt-3 flex w-full items-start gap-3 rounded-2xl border border-[#E8E4F5] bg-white p-3.5 text-left"
      >
        <span
          className={`mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-2 ${
            checked ? 'border-purple-500 bg-purple-500' : 'border-grey-300 bg-white'
          }`}
        >
          {checked && <CheckIcon />}
        </span>
        <span className="font-sans text-[15px] font-semibold leading-[1.35] text-ink-900">{BOX_LABEL}</span>
      </button>
      )}

      <Disclosure />
    </>
  )
}

export default function TextAlertsOptIn({ variant, stepLabel, stepIndex, stepCount, onDone }: TextAlertsOptInProps) {
  const source = variant
  const [status, setStatus] = useState<Status | null>(null)
  const [phone, setPhone] = useState('')
  const [moovesNumber, setMoovesNumber] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [checked, setChecked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const load = useCallback(async () => {
    setLoadFailed(false)
    try {
      const res = await fetch('/api/users/me/text-alerts')
      if (!res.ok) throw new Error('load failed')
      const data = (await res.json()) as { status: Status; phone: string }
      setStatus(data.status)
      setPhone(data.phone)
    } catch {
      setLoadFailed(true)
      // Onboarding still renders the proof (with no number) so a blip never
      // strands someone on their last step; Not now always works.
      if (variant === 'onboarding') setStatus('off')
    }
  }, [variant])

  useEffect(() => {
    initPostHog()
    posthog.capture('text_alerts_viewed', { source })
    void load()
  }, [load, source])

  async function optIn() {
    if (!checked || saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/users/me/text-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consentVersion: SMS_CONSENT_VERSION }),
      })
      if (!res.ok) throw new Error('opt-in failed')
      const data = (await res.json()) as { status: Status; phone: string }
      posthog.capture('text_alerts_opted_in', { source })
      setStatus(data.status)
      if (data.phone) setPhone(data.phone)
      setChecked(false)
      onDone(true)
    } catch {
      setError("Couldn't turn on text alerts. Try again.")
    } finally {
      setSaving(false)
    }
  }

  async function turnOff() {
    setConfirmOpen(false)
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/users/me/text-alerts', { method: 'DELETE' })
      if (!res.ok) throw new Error('opt-out failed')
      const data = (await res.json()) as { status: Status; phone: string }
      posthog.capture('text_alerts_opted_out', { source })
      setStatus(data.status)
      onDone(false)
    } catch {
      setError("Couldn't turn off text alerts. Try again.")
    } finally {
      setSaving(false)
    }
  }

  const ctaButton = (
    <button
      onClick={() => void optIn()}
      disabled={!checked || saving}
      className="w-full rounded-2xl bg-purple-500 py-4 font-display text-[16px] font-extrabold tracking-[-0.02em] text-white disabled:opacity-40"
    >
      {CTA}
    </button>
  )
  const errorLine = error && (
    <p role="alert" className="mb-2.5 text-center font-sans text-[12.5px] font-medium text-red-500">
      {error}
    </p>
  )

  // ── Onboarding ─────────────────────────────────────────────────────────────
  if (variant === 'onboarding') {
    const eyebrow = stepLabel ?? (stepIndex && stepCount ? `Step ${stepIndex} of ${stepCount}` : null)
    return (
      <div className="flex min-h-screen flex-col bg-purple-50">
        <div className="flex flex-1 flex-col px-6 pt-[calc(env(safe-area-inset-top)+3.5rem)]">
          {eyebrow && (
            <p className="mb-2.5 font-sans text-[11.5px] font-bold uppercase tracking-[0.12em] text-purple-500">
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-[24px] font-extrabold leading-[1.14] tracking-[-0.025em] text-ink-900">
            {HEADLINE}
          </h1>
          {status === null ? (
            <div className="mt-6 h-40 animate-pulse rounded-2xl bg-white/60" aria-hidden="true" />
          ) : (
            <ProofBody phone={phone} checked={checked} onToggle={() => setChecked(c => !c)} stopped={false} />
          )}
        </div>

        <div className="px-6 pb-[calc(env(safe-area-inset-bottom)+1.75rem)] pt-3">
          {stepIndex && stepCount ? (
            <div className="flex justify-center gap-1.5 pb-4" aria-hidden="true">
              {Array.from({ length: stepCount }, (_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full ${i + 1 === stepIndex ? 'w-[18px] bg-purple-500' : 'w-1.5 bg-grey-300'}`}
                />
              ))}
            </div>
          ) : null}
          {errorLine}
          {ctaButton}
          <button
            onClick={() => {
              posthog.capture('text_alerts_skipped', { source })
              onDone(false)
            }}
            className="mt-3 block w-full text-center font-sans text-[13.5px] font-medium text-ink-500"
          >
            Not now
          </button>
        </div>
      </div>
    )
  }

  // ── Settings ───────────────────────────────────────────────────────────────
  if (status === null) {
    return (
      <div className="flex flex-1 flex-col px-[18px] pt-5">
        {loadFailed ? (
          <div className="mt-10 text-center">
            <p className="font-sans text-[14px] text-ink-500">Couldn&apos;t load text alerts.</p>
            <button
              onClick={() => void load()}
              className="mt-4 inline-flex rounded-full bg-purple-100 px-8 py-3 font-sans text-[15px] font-semibold text-purple-500"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="h-48 animate-pulse rounded-2xl bg-white/60" aria-hidden="true" />
        )}
      </div>
    )
  }

  if (status === 'on') {
    return (
      <div className="flex flex-1 flex-col px-[18px] pb-[calc(env(safe-area-inset-bottom)+1.625rem)] pt-5">
        <h2 className="font-display text-[22px] font-extrabold leading-[1.2] tracking-[-0.02em] text-ink-900">
          {HEADLINE}
        </h2>
        <p className="mt-2.5 font-sans text-[14px] leading-[1.5] text-ink-500">{LEAD}</p>

        <span className="mt-3.5 inline-flex items-center gap-1.5 self-start rounded-full bg-purple-100 py-[5px] pl-2 pr-2.5 font-sans text-[12px] font-bold text-purple-700">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          On
        </span>

        <div className="mt-[18px] flex items-start gap-3 rounded-2xl border border-[#E8E4F5] bg-white p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-purple-100">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5F3FC4" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </span>
          <span className="min-w-0">
            <b className="block font-sans text-[15px] font-bold leading-[1.35] text-ink-900">
              You&apos;ll get texts at {phone}
            </b>
            <span className="mt-[3px] block font-sans text-[12.5px] leading-[1.5] text-ink-500">
              Up to 5 a day, 8am to 10pm. Mooves made overnight wait for one text at 8am.
            </span>
          </span>
        </div>

        <p className="mt-3 font-sans text-[12px] leading-[1.5] text-ink-500">
          Reply HELP for help, STOP to cancel. This is the number you sign in with.
        </p>

        <div className="mt-auto pt-6">
          {errorLine}
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={saving}
            className="w-full rounded-2xl border-[1.5px] border-[#E8E4F5] bg-white py-[15px] font-display text-[15px] font-extrabold tracking-[-0.02em] text-red-500 disabled:opacity-40"
          >
            Turn off
          </button>
        </div>

        {confirmOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-ink-900/40" onClick={() => setConfirmOpen(false)} aria-hidden="true" />
            <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col gap-2 px-2 [--safe-pb-base:1.625rem] safe-area-pb">
              <div className="overflow-hidden rounded-2xl border border-[#E8E4F5] bg-surface-bg/95 backdrop-blur-xl">
                <p className="border-b border-[#E8E4F5] px-[22px] pb-3 pt-3.5 text-center font-sans text-[12.5px] font-medium leading-[1.5] text-ink-500">
                  You&apos;ll stop getting texts from Mooves. You can turn them back on here any time.
                </p>
                <button
                  onClick={() => void turnOff()}
                  className="block w-full px-3 py-4 font-sans text-[17px] font-medium text-red-500"
                >
                  Turn off text alerts
                </button>
              </div>
              <button
                onClick={() => setConfirmOpen(false)}
                className="w-full rounded-2xl border border-[#E8E4F5] bg-surface-bg/95 py-4 font-sans text-[17px] font-bold text-ink-900 backdrop-blur-xl"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  // off, or stopped by STOP
  return (
    <div className="flex flex-1 flex-col px-[18px] pb-[calc(env(safe-area-inset-bottom)+1.625rem)] pt-5">
      <h2 className="font-display text-[22px] font-extrabold leading-[1.2] tracking-[-0.02em] text-ink-900">
        {HEADLINE}
      </h2>
      <ProofBody
        phone={phone}
        checked={checked}
        onToggle={() => setChecked(c => !c)}
        stopped={status === 'stopped'}
      />
      <div className="mt-auto pt-6">
        {errorLine}
        {status === 'stopped' ? (
          // Twilio blocks sends after STOP until the person texts START, so
          // that is the only honest way back. One tap opens Messages with it.
          moovesNumber && (
            <a
              href={`sms:${moovesNumber}?&body=START`}
              className="block w-full rounded-2xl bg-purple-500 py-[15px] text-center font-display text-[16px] font-extrabold tracking-[-0.02em] text-white"
            >
              Text START
            </a>
          )
        ) : (
          ctaButton
        )}
      </div>
    </div>
  )
}
