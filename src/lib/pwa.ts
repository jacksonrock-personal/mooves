// Phase 15 Surface A — PWA install helpers (client-only).
// Install state is derived from display-mode + platform; the nudge's cadence
// (value moment reached, dismissal cooldown, show cap) lives in localStorage.
// There is no server state for any of this.

const VALUE_MOMENT_KEY = 'mooves_value_moment'
const DISMISSED_AT_KEY = 'mooves_install_nudge_dismissed_at'
const COUNT_KEY = 'mooves_install_nudge_count'

export const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
export const MAX_SHOWS = 3

/** The `beforeinstallprompt` event isn't in the TS DOM lib yet. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

/** True when Mooves is running as an installed PWA (standalone), so no nudge. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone
}

/** True on iOS/iPadOS Safari, which has no beforeinstallprompt (needs the manual steps). */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return /iphone|ipad|ipod/i.test(ua) || iPadOS
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // private mode / storage disabled — the nudge simply won't persist cadence
  }
}

/** Records the value moment (first join/blast) + notifies a mounted nudge. */
export function markValueMoment(): void {
  if (read(VALUE_MOMENT_KEY)) return
  write(VALUE_MOMENT_KEY, '1')
  try {
    window.dispatchEvent(new Event('mooves:value-moment'))
  } catch {
    // no-op
  }
}

export function hasValueMoment(): boolean {
  return read(VALUE_MOMENT_KEY) === '1'
}

export function getNudgeCount(): number {
  const n = Number(read(COUNT_KEY))
  return Number.isFinite(n) ? n : 0
}

export function incrementNudgeCount(): void {
  write(COUNT_KEY, String(getNudgeCount() + 1))
}

export function markNudgeDismissed(): void {
  write(DISMISSED_AT_KEY, String(Date.now()))
}

function inCooldown(): boolean {
  const at = Number(read(DISMISSED_AT_KEY))
  if (!Number.isFinite(at) || at <= 0) return false
  return Date.now() - at < COOLDOWN_MS
}

/**
 * Whether the install nudge is eligible to show right now. `hasPrompt` is true
 * when a `beforeinstallprompt` was captured (Android/desktop install path).
 */
export function canShowNudge(hasPrompt: boolean): boolean {
  if (isStandalone()) return false // already installed
  if (!hasValueMoment()) return false // no value moment yet
  if (inCooldown()) return false // dismissed recently
  if (getNudgeCount() >= MAX_SHOWS) return false // capped
  // iOS shows the manual guide; other platforms need a real install prompt.
  return isIOS() || hasPrompt
}
