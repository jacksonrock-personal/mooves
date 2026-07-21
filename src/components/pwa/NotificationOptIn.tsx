'use client'

// Phase 15 Surface B — contextual notification opt-in. Mounted app-wide, silent
// until a value moment (first join/blast) fires `mooves:value-moment`. Shows the
// friendly pre-permission card; tapping "Turn on notifications" is the user
// gesture that triggers the OS prompt (never on load). On iOS the app must be
// installed first, so there we defer to the Surface A install nudge.

import { useEffect, useRef, useState } from 'react'
import Sheet from '@/components/ui/Sheet'
import CowMark from '@/components/ui/CowMark'
import { initPostHog, posthog } from '@/lib/posthog'
import { hasValueMoment, isIOS, isStandalone } from '@/lib/pwa'
import { enablePush, isPushSupported } from '@/lib/firebase/messaging'

const DISMISS_KEY = 'mooves_push_optin_dismissed_at'
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY))
    return Number.isFinite(at) && at > 0 && Date.now() - at < COOLDOWN_MS
  } catch {
    return false
  }
}

function platformTag(): string {
  if (isIOS()) return 'ios'
  return typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent) ? 'android' : 'web'
}

export default function NotificationOptIn() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const shownRef = useRef(false)

  useEffect(() => {
    initPostHog()

    async function evaluate() {
      if (shownRef.current || open) return
      if (typeof Notification === 'undefined' || Notification.permission !== 'default') return
      if (!hasValueMoment() || dismissedRecently()) return
      // iOS needs the installed PWA first — the install nudge handles that path.
      if (isIOS() && !isStandalone()) return
      if (!(await isPushSupported())) return
      // Never surface pre-auth. The card is mounted app-wide, so without this it can
      // render on logged-out surfaces like the /g/[code] group-invite landing before
      // the visitor has an account. /api/users/me is only ok for an authenticated session.
      try {
        const meRes = await fetch('/api/users/me')
        if (!meRes.ok) return
      } catch {
        return
      }
      shownRef.current = true
      posthog.capture('push_optin_shown', { platform: platformTag() })
      setOpen(true)
    }

    function onValueMoment() {
      void evaluate()
    }
    window.addEventListener('mooves:value-moment', onValueMoment)
    void evaluate()
    return () => window.removeEventListener('mooves:value-moment', onValueMoment)
  }, [open])

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // ignore
    }
    posthog.capture('push_optin_denied', { reason: 'dismissed' })
    setOpen(false)
  }

  async function enable() {
    if (busy) return
    setBusy(true)
    try {
      const token = await enablePush()
      if (!token) {
        posthog.capture('push_optin_denied', { reason: 'permission' })
        setOpen(false)
        return
      }
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fcmToken: token, platform: platformTag() }),
      })
      posthog.capture('push_optin_enabled', { platform: platformTag() })
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={dismiss} className="px-5 pb-7">
      <div>
        <div className="w-16 h-16 rounded-[19px] bg-[#F5F0ED] flex items-center justify-center mx-auto mb-3.5 overflow-hidden">
          <CowMark size={44} />
        </div>
        <h2 className="font-display font-extrabold text-[20px] text-ink-900 text-center tracking-[-0.01em] leading-tight">
          Know when your
          <br />
          group&apos;s free
        </h2>
        <p className="text-[13.5px] text-ink-500 text-center mt-2 leading-relaxed px-2">
          Get a heads up when someone in your group goes free, even when Mooves is closed. Only your groups, no noise.
        </p>
        <button
          onClick={() => void enable()}
          disabled={busy}
          className="w-full py-4 mt-6 rounded-full bg-purple-500 text-white font-sans font-bold text-[16px] disabled:opacity-50"
        >
          {busy ? 'One sec…' : 'Turn on notifications'}
        </button>
        <button onClick={dismiss} className="w-full py-3 mt-1 text-ink-500 font-sans font-semibold text-[14px]">
          Not now
        </button>
      </div>
    </Sheet>
  )
}
