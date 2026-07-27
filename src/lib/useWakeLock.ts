'use client'

// Phase 19 — keep the screen awake while a QR code is displayed.
//
// The spec asked whether the QR screen should also raise brightness. It cannot:
// there is no web API for screen brightness, on any browser. What does exist is
// the Screen Wake Lock API (Safari 16.4+, Chrome), so the screen simply doesn't
// sleep mid-scan. No UI mentions it.
//
// The lock is dropped whenever the tab is hidden (the browser does this for us
// on backgrounding) and re-taken on return, which is the documented pattern.

import { useEffect } from 'react'

export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    async function acquire() {
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) {
          void lock.release()
          return
        }
        sentinel = lock
      } catch {
        // Denied, unsupported, or the tab isn't visible. Not worth surfacing —
        // the screen just behaves normally.
      }
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibility)
      void sentinel?.release().catch(() => {})
      sentinel = null
    }
  }, [active])
}
