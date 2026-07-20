'use client'

// Phase 15 Surface A — registers the service worker (public/sw.js) once, on the
// client, in supported browsers. Renders nothing. The SW makes Mooves an
// installable PWA and is the host for Web Push (Surface B).

import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // registration failure is non-fatal — the app still works, just not installable
    })
  }, [])

  return null
}
