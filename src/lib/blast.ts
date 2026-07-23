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

// The time window a wave shares (17.1 amendment). 'now' also covers greens with
// no declared time. Single source for the phrase used in the strip headline, the
// wave push title, and the blast body, so all three read the same.
export type WaveTime = 'now' | 'tonight' | 'weekend'

export const WAVE_TIME_PHRASE: Record<WaveTime, string> = {
  now: 'right now',
  tonight: 'tonight',
  weekend: 'this weekend',
}

// The green-wave blast (17.2). UNLIKE the 2+-join blast above (A4: empty body),
// the wave blast opens with a prefilled body — the user still edits/sends it. Same
// OS-specific multi-recipient syntax + iOS group-thread caveat (shared POC).
function waveBlastBody(timeBucket: WaveTime): string {
  return `Anyone free ${WAVE_TIME_PHRASE[timeBucket]}? A few of us are green.`
}

export function buildWaveBlastHref(phones: string[], timeBucket: WaveTime = 'now'): string {
  const recipients = phones.filter(Boolean).join(',')
  const body = encodeURIComponent(waveBlastBody(timeBucket))
  const isIOS =
    typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
  return isIOS
    ? `sms:/open?addresses=${encodeURIComponent(recipients)}&body=${body}`
    : `sms:${recipients}?body=${body}`
}
