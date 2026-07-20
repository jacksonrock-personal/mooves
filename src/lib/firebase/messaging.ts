'use client'

// Phase 15 Surface B — client FCM helper. Mints a Web Push token bound to our
// own service worker (public/sw.js, registered in Surface A). Requires the
// Firebase config to include messagingSenderId + appId and the VAPID public key.

import { getMessaging, getToken, isSupported } from 'firebase/messaging'
import { firebaseApp } from './client'

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY

/** Web Push is only available with a service worker + Notification API + FCM support. */
export async function isPushSupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) return false
  try {
    return await isSupported()
  } catch {
    return false
  }
}

/**
 * Requests notification permission (must be called from a user gesture) and, on
 * grant, returns an FCM registration token bound to our service worker. Returns
 * null if unsupported, denied, or misconfigured.
 */
export async function enablePush(): Promise<string | null> {
  if (!VAPID_KEY) return null
  if (!(await isPushSupported())) return null

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  const registration = await navigator.serviceWorker.ready
  const messaging = getMessaging(firebaseApp)
  try {
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
    return token || null
  } catch {
    return null
  }
}
