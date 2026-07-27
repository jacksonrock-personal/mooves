// Phase 19.1 — "Add everyone here": a short-lived session that mutually friends
// everyone who scans one QR code, and creates NO group.
//
// Naming: the UI is deliberately verb-only ("Add everyone here", "4 joined",
// "Done") and never shows a noun. `roundup` lives in code and SQL only, where a
// noun is unavoidable. Do not let it reach user-facing copy.

// Same alphabet as referral codes: no 0/O or 1/I, which matters here because the
// code is also readable off a screen and typed by hand.
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Session code for the /r/<code> link. Longer than a referral code because a
 *  live code is guessable-in-principle; 10 chars over this alphabet is ~2^50. */
export function generateRoundupCode(): string {
  return Array.from({ length: 10 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('')
}

/** Cap counts everyone in the session, host included. Mirrored in roundup_join. */
export const ROUNDUP_CAP = 25

/** Auto-close window. Generous on purpose: a brand-new scanner walks the full
 *  signup (~90s) before they can join, and stragglers must still land. */
export const ROUNDUP_TTL_HOURS = 24

export function roundupUrl(code: string): string {
  return `https://makemooves.app/r/${code}`
}

export interface RoundupMember {
  id: string
  displayName: string | null
  avatarUrl: string | null
  isHost: boolean
  joinedAt: string
}

export interface RoundupSessionData {
  id: string
  code: string
  url: string
  expiresAt: string
  members: RoundupMember[]
}
