'use client'

// Phase 15 Surface B — Settings → Notifications. The permanent master control.
// On = permission granted + a token stored this device. Turning off drops the
// device's tokens (OS permission can't be revoked from the page, but no pushes
// are sent without a token).

import { useEffect, useState } from 'react'
import Toggle from '@/components/ui/Toggle'
import { posthog } from '@/lib/posthog'
import { isIOS } from '@/lib/pwa'
import { enablePush, isPushSupported } from '@/lib/firebase/messaging'

function platformTag(): string {
  if (isIOS()) return 'ios'
  return typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent) ? 'android' : 'web'
}

export default function NotificationSettings() {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [waveOn, setWaveOn] = useState(true) // 17.1 green-wave push opt-out

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const ok = await isPushSupported()
      if (cancelled) return
      setSupported(ok)
      setOn(ok && typeof Notification !== 'undefined' && Notification.permission === 'granted')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    fetch('/api/users/me')
      .then(r => r.json())
      .then((d: { wavePushEnabled?: boolean }) => {
        if (typeof d.wavePushEnabled === 'boolean') setWaveOn(d.wavePushEnabled)
      })
      .catch(() => {})
  }, [])

  async function toggleWave(next: boolean) {
    setWaveOn(next)
    posthog.capture(next ? 'wave_push_enabled' : 'wave_push_disabled')
    try {
      await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wavePushEnabled: next }),
      })
    } catch {
      // best-effort; leave the optimistic toggle as-is
    }
  }

  async function toggle(next: boolean) {
    if (busy) return
    setBusy(true)
    try {
      if (next) {
        const token = await enablePush()
        if (!token) {
          setOn(false)
          posthog.capture('push_optin_denied', { reason: 'permission', source: 'settings' })
          return
        }
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fcmToken: token, platform: platformTag() }),
        })
        setOn(true)
        posthog.capture('push_optin_enabled', { platform: platformTag(), source: 'settings' })
      } else {
        await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        setOn(false)
        posthog.capture('push_optin_denied', { reason: 'settings_off' })
      }
    } finally {
      setBusy(false)
    }
  }

  if (supported === false) return null // hide the section where push can't work

  return (
    <>
      <h2 className="font-sans text-[11px] font-bold uppercase tracking-[0.06em] text-ink-500 px-5 mb-2">
        Notifications
      </h2>
      <div className="bg-white border border-[#E8E4F5] rounded-[20px] mx-4">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="flex-1 min-w-0">
            <div className="font-sans font-bold text-[15px] text-ink-900">Notifications</div>
            <div className="font-sans text-[12.5px] text-ink-500 mt-0.5 leading-snug">
              Know when someone in your group is free.
            </div>
          </div>
          <Toggle on={on} onChange={next => void toggle(next)} disabled={busy || supported === null} label="Notifications" />
        </div>
      </div>
      <p className="font-sans text-[12px] text-ink-500 px-5 pt-3 leading-relaxed">
        You only get notified when a friend goes free for a group you&apos;re in. Turn any group off from its own page.
      </p>

      {/* 17.1 — green-wave push opt-out */}
      <div className="bg-white border border-[#E8E4F5] rounded-[20px] mx-4 mt-3">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="flex-1 min-w-0">
            <div className="font-sans font-bold text-[15px] text-ink-900">Green waves</div>
            <div className="font-sans text-[12.5px] text-ink-500 mt-0.5 leading-snug">
              A heads-up when a few friends are all free at once.
            </div>
          </div>
          <Toggle on={waveOn} onChange={next => void toggleWave(next)} disabled={on === false} label="Green waves" />
        </div>
      </div>
    </>
  )
}
