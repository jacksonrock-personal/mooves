// POST /api/tips/intent — Phase 14.1 cow tipping.
// Creates a one-time PaymentIntent for a consumer tip (money to Mooves only).
// The authed consumer is resolved from x-user-id (set by middleware). The
// amount is validated server-side — the client-displayed amount is never
// trusted. Returns the client_secret for the wallet (Express Checkout) flow.

import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { isValidTipAmount } from '@/lib/tips'

export async function POST(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { amount_cents?: unknown }
  try {
    body = (await req.json()) as { amount_cents?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const amount = body.amount_cents
  if (!isValidTipAmount(amount)) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  const pi = await stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    // type distinguishes tips from Phase 13 placement charges (which carry move_id).
    metadata: { type: 'tip', user_id: userId },
  })

  return NextResponse.json({ clientSecret: pi.client_secret })
}
