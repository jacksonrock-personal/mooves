// Server-side Stripe client + billing config (Phase 13 surface 4).

import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Flat placement fee, in cents. Configurable via env (2500 = $25).
export const PLACEMENT_PRICE_CENTS = Number(process.env.STRIPE_PLACEMENT_PRICE_CENTS ?? '2500')
