// Mooves service worker (Phase 15 Surface A).
// Minimal for now: it exists so the app is an installable PWA and to be the
// host for Web Push. There is intentionally no offline/fetch caching in v1.
//
// Surface B (Web Push) will extend this file with `push` and `notificationclick`
// handlers — do not remove the registration this depends on.

self.addEventListener('install', () => {
  // Activate this worker immediately rather than waiting for old tabs to close.
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  // Take control of open clients as soon as the worker activates.
  event.waitUntil(self.clients.claim())
})
