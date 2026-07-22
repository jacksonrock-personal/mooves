// Server-side Stripe client + billing config (Phase 13 surface 4).

import Stripe from 'stripe'

const secretKey = process.env.STRIPE_SECRET_KEY
if (!secretKey) {
  // Fail loudly at first use instead of letting the SDK throw an opaque error
  // deep inside a payment route.
  throw new Error('STRIPE_SECRET_KEY is not set')
}

// Go-live guardrails (see STRIPE-GOLIVE.md). Warn, don't throw: a mismatch
// should be visible in logs without taking every payment route down.
const secretIsLive = secretKey.startsWith('sk_live_') || secretKey.startsWith('rk_live_')
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''
if (publishableKey && publishableKey.startsWith('pk_live_') !== secretIsLive) {
  console.error(
    '[stripe] key mode mismatch: STRIPE_SECRET_KEY is',
    secretIsLive ? 'LIVE' : 'TEST',
    'but NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not. Client payments will fail.',
  )
}
if (process.env.VERCEL_ENV === 'production' && !secretIsLive) {
  console.error('[stripe] production deployment is using TEST keys, payments will not charge real cards')
}

export const stripe = new Stripe(secretKey)

// Flat placement fee, in cents. Configurable via env (2500 = $25).
export const PLACEMENT_PRICE_CENTS = Number(process.env.STRIPE_PLACEMENT_PRICE_CENTS ?? '2500')
