// POST /api/stripe/webhook — Stripe event receiver (Phase 13 surface 4).
// Public route (Stripe calls it unauthenticated); gated by signature
// verification. Confirms placement charges: succeeded → move paid + live;
// failed → record the attempt so the sponsor sees "payment failed".

import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!sig || !secret) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  const raw = await req.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent
    const moveId = pi.metadata?.move_id
    if (moveId) {
      // Filter on paid_at IS NULL keeps this idempotent across retries.
      await supabase
        .from('sponsored_moves')
        .update({ paid_at: new Date().toISOString(), stripe_payment_intent_id: pi.id, price_cents: pi.amount })
        .eq('id', moveId)
        .is('paid_at', null)
    }
  } else if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent
    const moveId = pi.metadata?.move_id
    if (moveId) {
      await supabase
        .from('sponsored_moves')
        .update({ stripe_payment_intent_id: pi.id })
        .eq('id', moveId)
        .is('paid_at', null)
    }
  }

  return NextResponse.json({ received: true })
}
