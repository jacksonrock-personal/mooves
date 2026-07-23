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

// The green-wave blast (17.2). UNLIKE the 2+-join blast above (A4: empty body),
// the wave blast opens with a prefilled body — the user still edits/sends it. Same
// OS-specific multi-recipient syntax + iOS group-thread caveat (shared POC).
const WAVE_BLAST_BODY = "Anyone free tonight? A few of us are green."

export function buildWaveBlastHref(phones: string[]): string {
  const recipients = phones.filter(Boolean).join(',')
  const body = encodeURIComponent(WAVE_BLAST_BODY)
  const isIOS =
    typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
  return isIOS
    ? `sms:/open?addresses=${encodeURIComponent(recipients)}&body=${body}`
    : `sms:${recipients}?body=${body}`
}
