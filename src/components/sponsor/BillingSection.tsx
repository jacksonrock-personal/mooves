'use client'

// Phase 13 surface 4 — sponsor Billing section. Card on file via Stripe Elements
// (SetupIntent). Card details are tokenized by Stripe; they never reach us.

import { useEffect, useState } from 'react'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { getStripe } from '@/lib/stripe-client'

interface CardInfo {
  hasCard: boolean
  placementPriceCents: number
  brand?: string | null
  last4?: string | null
  expMonth?: number | null
  expYear?: number | null
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`
}

function CardForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!stripe || !elements || busy) return
    setBusy(true)
    setError(null)
    const { error: confErr, setupIntent } = await stripe.confirmSetup({ elements, redirect: 'if_required' })
    if (confErr) {
      setError(confErr.message ?? 'Could not save the card.')
      setBusy(false)
      return
    }
    const pm = setupIntent?.payment_method
    const paymentMethodId = typeof pm === 'string' ? pm : pm?.id
    if (!paymentMethodId) {
      setError('Could not save the card.')
      setBusy(false)
      return
    }
    const res = await fetch('/api/sponsor/billing/payment-method', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethodId }),
    })
    if (!res.ok) {
      setError('Could not save the card, try again.')
      setBusy(false)
      return
    }
    onSaved()
  }

  return (
    <div>
      <PaymentElement />
      {error && <p className="text-[13px] text-red-500 mt-3">{error}</p>}
      <div className="flex items-center gap-2 mt-2 mb-1 text-[11.5px] text-grey-300">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="4" y="10" width="16" height="10" rx="2" stroke="#BDB5D4" strokeWidth="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="#BDB5D4" strokeWidth="2" /></svg>
        Secured by Stripe. We store a token, never your card number.
      </div>
      <div className="flex gap-2.5 mt-4">
        <button onClick={() => void submit()} disabled={busy || !stripe} className="bg-purple-500 text-white font-semibold text-[13.5px] rounded-[10px] px-4 py-2.5 disabled:opacity-40">
          {busy ? 'Saving…' : 'Save card'}
        </button>
        <button onClick={onCancel} className="bg-white border border-[#E8E4F5] text-ink-900 font-semibold text-[13.5px] rounded-[10px] px-4 py-2.5">Cancel</button>
      </div>
    </div>
  )
}

export default function BillingSection() {
  const [loading, setLoading] = useState(true)
  const [card, setCard] = useState<CardInfo | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function loadCard() {
    const data = (await fetch('/api/sponsor/billing').then(r => r.json())) as CardInfo
    setCard(data)
    setLoading(false)
  }
  useEffect(() => { void loadCard() }, [])

  async function startAdd() {
    setBusy(true)
    const { clientSecret } = (await fetch('/api/sponsor/billing/setup-intent', { method: 'POST' }).then(r => r.json())) as {
      clientSecret: string
    }
    setClientSecret(clientSecret)
    setBusy(false)
  }

  async function removeCard() {
    setBusy(true)
    await fetch('/api/sponsor/billing', { method: 'DELETE' })
    setClientSecret(null)
    await loadCard()
    setBusy(false)
  }

  function onSaved() {
    setClientSecret(null)
    void loadCard()
  }

  const price = card ? dollars(card.placementPriceCents) : '$25'

  if (loading) {
    return <div className="flex justify-center pt-16"><div className="w-7 h-7 rounded-full border-[3px] border-purple-100 border-t-purple-500 animate-spin" /></div>
  }

  // Adding / updating a card → Stripe Elements form.
  if (clientSecret) {
    return (
      <div className="bg-white border border-[#E8E4F5] rounded-[14px] p-5 max-w-[520px]">
        <h4 className="font-display font-extrabold text-[15px] text-ink-900 mb-1.5">Add a payment method</h4>
        <p className="text-[13px] text-ink-500 leading-relaxed mb-4">Your card is handled by Stripe. Card details never touch Mooves&apos; servers.</p>
        <Elements stripe={getStripe()} options={{ clientSecret, appearance: { variables: { colorPrimary: '#7C5CDB', borderRadius: '10px' } } }}>
          <CardForm onSaved={onSaved} onCancel={() => setClientSecret(null)} />
        </Elements>
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#E8E4F5] rounded-[14px] p-5 max-w-[520px]">
      <h4 className="font-display font-extrabold text-[15px] text-ink-900 mb-1.5">Payment method</h4>
      {card?.hasCard ? (
        <>
          <div className="flex items-center gap-3 border border-[#E8E4F5] rounded-[12px] p-3.5 my-3">
            <div className="w-11 h-[30px] rounded-[5px] bg-[#1A1F71] text-white font-extrabold text-[11px] italic flex items-center justify-center shrink-0">
              {(card.brand ?? 'CARD').toUpperCase().slice(0, 4)}
            </div>
            <div className="flex-1">
              <div className="font-bold text-[14px] text-ink-900 capitalize">{card.brand} ending {card.last4}</div>
              <div className="text-[12px] text-ink-500">Expires {card.expMonth} / {card.expYear}</div>
            </div>
          </div>
          <div className="bg-purple-50 border border-[#E8E4F5] rounded-[12px] px-3.5 py-3 text-[13px] text-ink-900 mb-4">
            You&apos;re billed <b className="text-purple-700">{price}</b> per placement, automatically when a move goes live.
          </div>
          <div className="flex gap-2.5">
            <button onClick={() => void startAdd()} disabled={busy} className="bg-white border border-[#E8E4F5] text-ink-900 font-semibold text-[13.5px] rounded-[10px] px-4 py-2.5 disabled:opacity-40">Update card</button>
            <button onClick={() => void removeCard()} disabled={busy} className="bg-white border border-red-500 text-red-500 font-semibold text-[13.5px] rounded-[10px] px-4 py-2.5 disabled:opacity-40">Remove</button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[13px] text-ink-500 leading-relaxed mb-3">Add a card once. When a move is approved and goes live, you&apos;re billed automatically. You&apos;re never charged for moves under review or rejected.</p>
          <div className="bg-purple-50 border border-[#E8E4F5] rounded-[12px] px-3.5 py-3 text-[13px] text-ink-900 mb-4">
            Placement fee: <b className="text-purple-700">{price}</b> per move, charged when it goes live.
          </div>
          <button onClick={() => void startAdd()} disabled={busy} className="bg-purple-500 text-white font-semibold text-[13.5px] rounded-[10px] px-4 py-2.5 disabled:opacity-40">+ Add a payment method</button>
        </>
      )}
    </div>
  )
}
