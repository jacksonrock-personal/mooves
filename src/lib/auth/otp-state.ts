import type { ConfirmationResult } from 'firebase/auth'

// Module-level singleton — lives for the lifetime of the client JS bundle.
// Holds the Firebase ConfirmationResult between the 2a→2b page transition.
// Not serializable, so sessionStorage can't store it.
// If the user hard-refreshes on 2b, this is null → OTP page redirects back to 2a.

let _confirmationResult: ConfirmationResult | null = null

export function storeConfirmationResult(result: ConfirmationResult): void {
  _confirmationResult = result
}

export function retrieveConfirmationResult(): ConfirmationResult | null {
  return _confirmationResult
}

export function clearConfirmationResult(): void {
  _confirmationResult = null
}
