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

// Phase 15 Surface B — Web Push. Messages are sent data-only (title/body/url as
// strings) so this worker is the single place that builds the notification —
// avoids the browser auto-displaying a duplicate.
self.addEventListener('push', event => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }
  const data = payload.data || payload || {}
  const title = data.title || 'Mooves'
  const body = data.body || ''
  const url = data.url || '/feed'
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/brand/icon-180.png',
      badge: '/brand/icon-180.png',
      tag: data.tag || 'mooves-group-green',
      data: { url },
    }),
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/feed'
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of all) {
        if ('focus' in client) {
          try {
            await client.navigate(url)
          } catch {
            // navigate can reject cross-origin — fall back to focus
          }
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })(),
  )
})
