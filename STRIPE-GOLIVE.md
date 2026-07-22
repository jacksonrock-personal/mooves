# Stripe Go-Live Runbook

The code is env-driven, there is no test-mode logic to change. Going live is
Stripe-dashboard work plus Vercel env vars. Work through this top to bottom.

## 1. Activate the Stripe account

Dashboard → complete the business profile and payout bank account. Until this
is done the account cannot accept live charges. Business entity and support
details should match what `/terms` and `/privacy` state.

## 2. Live keys

Toggle the dashboard to **Live mode**, then collect:

- Publishable key `pk_live_…`
- Secret key — prefer a **restricted key** (`rk_live_…`) with write access to
  PaymentIntents, SetupIntents, Customers, and PaymentMethods only. That is
  everything `src/lib/*` and the API routes use.

## 3. Live webhook endpoint

Developers → Webhooks → Add endpoint:

- URL: `https://makemooves.app/api/stripe/webhook`
- Events: `payment_intent.succeeded`, `payment_intent.payment_failed`
  (the only two `src/app/api/stripe/webhook/route.ts` handles)

Copy the endpoint's signing secret (`whsec_…`).

## 4. Payment method domain

Settings → Payment method domains → register `makemooves.app`.

Without this, the TipJar's `ExpressCheckoutElement` (Apple Pay / Google Pay)
silently renders nothing in live mode.

## 5. Vercel env vars (Production scope only)

| Var | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `rk_live_…` (or `sk_live_…`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from step 3 |
| `STRIPE_PLACEMENT_PRICE_CENTS` | `2500` unless the launch price changes |

Keep `.env.local` and Vercel Preview on **test** keys so dev never touches
real money.

Then **redeploy** — `NEXT_PUBLIC_*` is baked at build time, a restart is not
enough.

`src/lib/stripe.ts` logs an error on boot if the key modes are mismatched or
a production deploy is still on test keys.

## 6. Smoke test

1. Send yourself a $1 tip on prod.
2. Confirm the `tips` row lands in Supabase (proves the webhook round-trip).
3. Refund the payment from the Stripe dashboard.
4. Sponsor flow: add a payment method, confirm it appears on a live-mode
   Customer in the dashboard.
