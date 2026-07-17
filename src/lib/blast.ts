// Build the native SMS deep link for the group-chat blast (Phase 9.3).
//
// No prefilled body (amendment A4) — the composer opens with an empty message and
// the user writes it. Multi-recipient `sms:` syntax differs by OS; iOS Messages
// honors `sms:/open?addresses=…` to keep everyone in one thread, Android uses a
// comma-separated list. Flagged as a device POC in the spec — validate on hardware.

export function buildBlastHref(phones: string[]): string {
  const recipients = phones.filter(Boolean).join(',')
  const isIOS =
    typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
  return isIOS
    ? `sms:/open?addresses=${encodeURIComponent(recipients)}`
    : `sms:${recipients}`
}
