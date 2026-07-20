'use client'

// Phase 14.1 — cow tipping. A gentle tip jar at the bottom of the Feed, shown
// only when 3+ moves are live (the parent passes `visible`). Tapping it opens a
// sheet: pick an amount → pay with Apple Pay / Google Pay (wallet-only, via the
// Stripe Express Checkout Element, no card fields) → a warm cow thank-you.
// Money goes to Mooves only; there are no totals, badges, or status anywhere.

import { useEffect, useRef, useState } from 'react'
import { Elements, ExpressCheckoutElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { getStripe } from '@/lib/stripe-client'
import { posthog } from '@/lib/posthog'
import { TIP_PRESETS_CENTS, TIP_MAX_CENTS, isValidTipAmount, formatTip } from '@/lib/tips'
import CowMark from '@/components/ui/CowMark'
import Sheet from '@/components/ui/Sheet'

type Step = 'amount' | 'pay' | 'thanks' | 'error'

function CowTile({ size, className = '' }: { size: number; className?: string }) {
  return (
    <div className={`bg-[#F5F0ED] flex items-center justify-center overflow-hidden ${className}`}>
      <CowMark size={size} />
    </div>
  )
}

// The wallet step: Express Checkout Element (Apple Pay / Google Pay only).
function WalletPay({
  amountCents,
  onSuccess,
  onError,
}: {
  amountCents: number
  onSuccess: () => void
  onError: (message: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [noWallet, setNoWallet] = useState(false)

  return (
    <div>
      <ExpressCheckoutElement
        options={{ buttonType: { applePay: 'buy', googlePay: 'buy' } }}
        onReady={event => {
          if (!event.availablePaymentMethods) setNoWallet(true)
        }}
        onConfirm={async () => {
          if (!stripe || !elements) return
          const { error } = await stripe.confirmPayment({ elements, redirect: 'if_required' })
          if (error) onError(error.message ?? 'That payment could not be completed.')
          else onSuccess()
        }}
      />
      {noWallet ? (
        <p className="text-[13px] text-ink-500 text-center leading-relaxed mt-2">
          Apple Pay or Google Pay isn&apos;t available on this device, so there&apos;s no way to tip right now. Thanks for the thought.
        </p>
      ) : (
        <div className="flex items-center justify-center gap-1.5 text-[11.5px] text-grey-300 mt-4">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <rect x="4" y="10" width="16" height="10" rx="2" stroke="#BDB5D4" strokeWidth="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="#BDB5D4" strokeWidth="2" />
          </svg>
          Secured by Stripe · {formatTip(amountCents)} to Mooves
        </div>
      )}
    </div>
  )
}

export default function TipJar({ visible }: { visible: boolean }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('amount')
  const [amountCents, setAmountCents] = useState<number>(300)
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const shownRef = useRef(false)

  // Fire the impression once, the first time the jar becomes visible.
  useEffect(() => {
    if (visible && !shownRef.current) {
      shownRef.current = true
      posthog.capture('tip_jar_shown')
    }
  }, [visible])

  if (!visible) return null

  function openSheet() {
    setStep('amount')
    setAmountCents(300)
    setCustom('')
    setClientSecret(null)
    setOpen(true)
  }

  function selectPreset(cents: number) {
    setAmountCents(cents)
    setCustom('')
  }

  function onCustomChange(value: string) {
    // digits + one optional decimal, dollars → cents
    const clean = value.replace(/[^0-9.]/g, '')
    setCustom(clean)
    const dollars = parseFloat(clean)
    setAmountCents(Number.isFinite(dollars) ? Math.round(dollars * 100) : 0)
  }

  async function handleContinue() {
    if (!isValidTipAmount(amountCents) || busy) return
    setBusy(true)
    posthog.capture('tip_amount_selected', { amount_cents: amountCents })
    try {
      const res = await fetch('/api/tips/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_cents: amountCents }),
      })
      if (!res.ok) throw new Error('intent failed')
      const { clientSecret } = (await res.json()) as { clientSecret: string }
      setClientSecret(clientSecret)
      posthog.capture('tip_started', { amount_cents: amountCents })
      setStep('pay')
    } catch {
      setStep('error')
    } finally {
      setBusy(false)
    }
  }

  function handleSuccess() {
    posthog.capture('tip_succeeded', { amount_cents: amountCents })
    setStep('thanks')
  }

  function handleError() {
    posthog.capture('tip_failed', { amount_cents: amountCents })
    setStep('error')
  }

  const canContinue = isValidTipAmount(amountCents)

  return (
    <>
      {/* Jar card at the bottom of the feed */}
      <button
        onClick={openSheet}
        className="w-full text-left flex items-center gap-3 rounded-[18px] border-[1.5px] border-purple-100 bg-white px-3.5 py-3.5 mt-1.5"
      >
        <CowTile size={34} className="w-[46px] h-[46px] rounded-[14px] shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block font-display font-extrabold text-[15px] text-ink-900">Cow Tipping</span>
          <span className="block text-[12px] leading-snug text-ink-500 mt-0.5">
            If it got you out today, consider tipping the cow.
          </span>
        </span>
        <span className="shrink-0 w-10 h-10 rounded-full bg-purple-500 text-white font-display font-extrabold text-[19px] flex items-center justify-center">
          $
        </span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} className="px-5 pb-7">
        {step === 'amount' && (
          <div>
            <CowTile size={42} className="w-[60px] h-[60px] rounded-[18px] mx-auto mb-3.5" />
            <h2 className="font-display font-extrabold text-[20px] text-ink-900 text-center tracking-[-0.01em]">Tip the cow</h2>
            <p className="text-[13.5px] text-ink-500 text-center mt-1.5 leading-relaxed">
              One time, goes straight to Mooves. No perks, no strings.
            </p>
            <div className="flex gap-2.5 mt-5 mb-3">
              {TIP_PRESETS_CENTS.map(cents => {
                const sel = !custom && amountCents === cents
                return (
                  <button
                    key={cents}
                    onClick={() => selectPreset(cents)}
                    className={`flex-1 rounded-[14px] border-[1.5px] py-3.5 font-display font-extrabold text-[18px] ${
                      sel ? 'border-purple-500 bg-purple-100 text-purple-700' : 'border-purple-100 bg-white text-ink-900'
                    }`}
                  >
                    {formatTip(cents)}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center border-[1.5px] border-purple-100 rounded-[14px] px-4 h-[50px] mb-5">
              <span className="text-[13.5px] text-ink-500 font-medium">Other amount</span>
              <span className="ml-auto font-display font-extrabold text-[18px] text-grey-300">$</span>
              <input
                value={custom}
                onChange={e => onCustomChange(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                aria-label="Custom tip amount"
                className="w-16 text-right font-display font-extrabold text-[18px] text-ink-900 outline-none bg-transparent ml-0.5"
              />
            </div>
            <button
              onClick={() => void handleContinue()}
              disabled={!canContinue || busy}
              className="w-full py-4 rounded-full bg-purple-500 text-white font-sans font-bold text-[16px] disabled:opacity-40"
            >
              {busy ? 'One sec…' : 'Continue'}
            </button>
            <button onClick={() => setOpen(false)} className="w-full py-3 mt-1 text-ink-500 font-sans font-semibold text-[14px]">
              Maybe later
            </button>
            {custom && !canContinue && (
              <p className="text-[12px] text-ink-500 text-center mt-2">Enter an amount between $1 and {formatTip(TIP_MAX_CENTS)}.</p>
            )}
          </div>
        )}

        {step === 'pay' && clientSecret && (
          <div>
            <h2 className="font-display font-extrabold text-[20px] text-ink-900 text-center tracking-[-0.01em]">
              You&apos;re tipping {formatTip(amountCents)}
            </h2>
            <p className="text-[13.5px] text-ink-500 text-center mt-1.5">One-time, straight to Mooves.</p>
            <div className="mt-5">
              <Elements
                stripe={getStripe()}
                options={{ clientSecret, appearance: { variables: { colorPrimary: '#7C5CDB', borderRadius: '12px' } } }}
              >
                <WalletPay amountCents={amountCents} onSuccess={handleSuccess} onError={handleError} />
              </Elements>
            </div>
            <button onClick={() => setOpen(false)} className="w-full py-3 mt-3 text-ink-500 font-sans font-semibold text-[14px]">
              Cancel
            </button>
          </div>
        )}

        {step === 'thanks' && (
          <div className="text-center">
            <div className="relative w-24 h-24 rounded-[28px] bg-[#F5F0ED] flex items-center justify-center mx-auto mb-4 overflow-hidden">
              <CowMark size={66} />
            </div>
            <h2 className="font-display font-extrabold text-[20px] text-ink-900 tracking-[-0.01em]">Thank you, really.</h2>
            <p className="text-[13.5px] text-ink-500 mt-1.5 leading-relaxed px-2">
              The cow is touched. That&apos;s it, no points, no badges, just our thanks. Now go be free.
            </p>
            <button
              onClick={() => setOpen(false)}
              className="w-full py-4 mt-6 rounded-full bg-purple-500 text-white font-sans font-bold text-[16px]"
            >
              Back to your feed
            </button>
          </div>
        )}

        {step === 'error' && (
          <div className="text-center">
            <div className="w-[60px] h-[60px] rounded-full bg-red-tint flex items-center justify-center mx-auto mb-3.5">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#E8405A" strokeWidth="2" />
                <path d="M12 7v6M12 16.5v.5" stroke="#E8405A" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="font-display font-extrabold text-[20px] text-ink-900 tracking-[-0.01em]">That didn&apos;t go through</h2>
            <p className="text-[13.5px] text-ink-500 mt-1.5 leading-relaxed px-2">
              You weren&apos;t charged. Want to give it another try?
            </p>
            <button
              onClick={() => setStep(clientSecret ? 'pay' : 'amount')}
              className="w-full py-4 mt-6 rounded-full bg-purple-500 text-white font-sans font-bold text-[16px]"
            >
              Try again
            </button>
            <button onClick={() => setOpen(false)} className="w-full py-3 mt-1 text-ink-500 font-sans font-semibold text-[14px]">
              Not now
            </button>
          </div>
        )}
      </Sheet>
    </>
  )
}
