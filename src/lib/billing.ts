// Placement billing (Phase 13 surface 4). Off-session charge for a sponsor's
// approved move; on success the move gets paid_at and becomes live. Called on
// moderation-approve and after a sponsor adds/updates a card.

import type Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/server'
import { stripe, PLACEMENT_PRICE_CENTS } from '@/lib/stripe'

export type ChargeResult = 'charged' | 'no_payment_method' | 'failed' | 'skipped'

/**
 * Attempt the flat placement charge for a move. Idempotent-ish: skips if the
 * move isn't an approved, sponsor-authored, unpaid move. The webhook is the
 * authoritative confirmation (also sets paid_at); this fast-paths the common
 * synchronous success.
 */
export async function chargeForPlacement(moveId: string): Promise<ChargeResult> {
  const supabase = createServiceClient()

  const { data: move } = await supabase
    .from('sponsored_moves')
    .select('id, sponsor_id, status, paid_at')
    .eq('id', moveId)
    .single()

  if (!move) return 'skipped'
  if (move.status !== 'approved') return 'skipped'
  if (!move.sponsor_id) return 'skipped' // Mooves-authored → no billing
  if (move.paid_at) return 'skipped' // already paid

  const { data: sponsor } = await supabase
    .from('sponsors')
    .select('stripe_customer_id, default_payment_method_id')
    .eq('id', move.sponsor_id)
    .single()

  if (!sponsor?.stripe_customer_id || !sponsor.default_payment_method_id) return 'no_payment_method'

  try {
    const pi = await stripe.paymentIntents.create({
      amount: PLACEMENT_PRICE_CENTS,
      currency: 'usd',
      customer: sponsor.stripe_customer_id,
      payment_method: sponsor.default_payment_method_id,
      off_session: true,
      confirm: true,
      metadata: { move_id: move.id },
    })

    // Record the attempt (marks the move as "charge attempted" for the dashboard).
    const paidAt = pi.status === 'succeeded' ? new Date().toISOString() : null
    await supabase
      .from('sponsored_moves')
      .update({ stripe_payment_intent_id: pi.id, price_cents: PLACEMENT_PRICE_CENTS, paid_at: paidAt })
      .eq('id', move.id)

    return pi.status === 'succeeded' ? 'charged' : 'failed'
  } catch (err) {
    // Declined / requires authentication off-session. Record the PI id (if any)
    // so the dashboard shows "payment failed" rather than "awaiting payment".
    const pi = (err as { payment_intent?: Stripe.PaymentIntent }).payment_intent
    await supabase
      .from('sponsored_moves')
      .update({ stripe_payment_intent_id: pi?.id ?? null, price_cents: PLACEMENT_PRICE_CENTS })
      .eq('id', move.id)
    return 'failed'
  }
}

/** Charge every approved, unpaid move for a sponsor (after they add a card). */
export async function chargePendingForSponsor(sponsorId: string): Promise<void> {
  const supabase = createServiceClient()
  const { data: moves } = await supabase
    .from('sponsored_moves')
    .select('id')
    .eq('sponsor_id', sponsorId)
    .eq('status', 'approved')
    .is('paid_at', null)
  for (const m of moves ?? []) {
    await chargeForPlacement(m.id)
  }
}
