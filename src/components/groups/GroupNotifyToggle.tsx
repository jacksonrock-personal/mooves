'use client'

// Phase 15 Surface B — per-group notification control, shown on a group you're a
// member of (members are the push recipients; owners are the senders). On =
// notify me for this group, Off = muted. State is stored in group_notification_mutes.

import { useEffect, useState } from 'react'
import Toggle from '@/components/ui/Toggle'
import { posthog } from '@/lib/posthog'

export default function GroupNotifyToggle({ groupId }: { groupId: string }) {
  const [notify, setNotify] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetch(`/api/push/mute?groupId=${groupId}`)
      const data = (await res.json().catch(() => ({ muted: false }))) as { muted?: boolean }
      if (!cancelled) setNotify(!data.muted)
    })()
    return () => {
      cancelled = true
    }
  }, [groupId])

  async function toggle(next: boolean) {
    if (busy) return
    setBusy(true)
    const previous = notify
    setNotify(next)
    try {
      const res = await fetch('/api/push/mute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, muted: !next }),
      })
      if (!res.ok) throw new Error('mute failed')
      posthog.capture(next ? 'push_group_unmuted' : 'push_group_muted')
    } catch {
      setNotify(previous ?? true)
    } finally {
      setBusy(false)
    }
  }

  const on = notify ?? true

  return (
    <>
      <p className="font-sans text-[11px] font-semibold text-ink-500 uppercase tracking-[0.08em] px-5 pt-4 pb-1">
        Notifications
      </p>
      <div className="bg-white border-y border-[#E8E4F5]">
        <div className="flex items-center gap-3 px-5 py-3.5">
          <div className="flex-1 min-w-0">
            <div className="font-sans font-bold text-[15px] text-ink-900">
              {on ? 'Notify me for this group' : 'Muted'}
            </div>
            <div className="font-sans text-[12.5px] text-ink-500 mt-0.5 leading-snug">
              {on ? "You'll know when someone here goes free." : "You won't be notified for this group."}
            </div>
          </div>
          <Toggle on={on} onChange={next => void toggle(next)} disabled={notify === null || busy} label="Group notifications" />
        </div>
      </div>
    </>
  )
}
