// POST /api/stripe/webhook — Stripe event receiver.
// Public route (Stripe calls it unauthenticated); gated by signature
// verification. Handles two PaymentIntent kinds by metadata:
//  - Phase 13 placements (metadata.move_id): succeeded → move paid + live;
//    failed → record the attempt so the sponsor sees "payment failed".
//  - Phase 14.1 tips (metadata.type='tip'): succeeded → insert a ledger row.

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
    if (pi.metadata?.type === 'tip') {
      // Phase 14.1 tip. Insert a ledger row; the unique stripe_payment_intent_id
      // keeps this idempotent across webhook retries (ignoreDuplicates = no-op on conflict).
      const userId = pi.metadata?.user_id
      await supabase.from('tips').upsert(
        {
          user_id: userId || null,
          amount_cents: pi.amount,
          stripe_payment_intent_id: pi.id,
        },
        { onConflict: 'stripe_payment_intent_id', ignoreDuplicates: true },
      )
    } else if (moveId) {
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
