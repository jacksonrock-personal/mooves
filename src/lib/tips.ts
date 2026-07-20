// Phase 14.1 — cow tipping constants + validation. Shared by the tip-intent
// API route (server, source of truth) and the TipJar UI (client). Tips are
// one-time, variable-amount, money-to-Mooves-only.

// Preset one-time amounts shown in the tip jar, in cents.
export const TIP_PRESETS_CENTS = [100, 300, 500] as const

// Accepted range for any tip (preset or custom), in cents. $1–$200.
export const TIP_MIN_CENTS = 100
export const TIP_MAX_CENTS = 20000

/** True if `cents` is a whole-cent integer within the accepted tip range. */
export function isValidTipAmount(cents: unknown): cents is number {
  return typeof cents === 'number' && Number.isInteger(cents) && cents >= TIP_MIN_CENTS && cents <= TIP_MAX_CENTS
}

/** "$1", "$3.50" — trims a trailing ".00". */
export function formatTip(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`
}
