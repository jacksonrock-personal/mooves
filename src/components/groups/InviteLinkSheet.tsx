'use client'

// Phase 10.2: the owner's invite-link affordance (opened from the group edit
// screen). Shows the persistent link with Copy / Share, plus Reset (revoke +
// regenerate — the old link stops working).

import { useEffect, useState } from 'react'
import Sheet from '@/components/ui/Sheet'
import { posthog } from '@/lib/posthog'

interface InviteLinkSheetProps {
  open: boolean
  onClose: () => void
  groupId: string
  groupName: string
  groupEmoji: string
  memberCount: number
}

export default function InviteLinkSheet({
  open,
  onClose,
  groupId,
  groupName,
  groupEmoji,
  memberCount,
}: InviteLinkSheetProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    if (!open) return
    setUrl(null)
    setCopied(false)
    setLoading(true)
    fetch(`/api/groups/${groupId}/invite`)
      .then(r => r.json())
      .then((d: { url?: string }) => setUrl(d.url ?? null))
      .catch(() => setUrl(null))
      .finally(() => setLoading(false))
  }, [open, groupId])

  async function handleCopy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      posthog.capture('group_invite_copied')
    } catch {
      // clipboard blocked — no-op
    }
  }

  async function handleShare() {
    if (!url) return
    posthog.capture('group_invite_shared')
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: `Join ${groupName} on Mooves`, url })
      } catch {
        // user dismissed share sheet — no-op
      }
    } else {
      await handleCopy()
    }
  }

  async function handleReset() {
    if (resetting) return
    setResetting(true)
    posthog.capture('group_invite_reset')
    try {
      const d = (await fetch(`/api/groups/${groupId}/invite`, { method: 'POST' }).then(r => r.json())) as { url?: string }
      setUrl(d.url ?? null)
      setCopied(false)
    } catch {
      // leave the old link shown
    } finally {
      setResetting(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} className="px-5 pb-8">
      <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center text-[28px] leading-none mx-auto mb-3.5">
        {groupEmoji}
      </div>
      <h2 className="font-display font-extrabold text-[19px] text-ink-900 text-center tracking-tight mb-1.5">
        Invite to {groupName}
      </h2>
      <p className="font-sans text-[14px] text-ink-500 text-center leading-relaxed mb-5">
        Anyone who taps this joins {groupName} and connects with all {memberCount}{' '}
        {memberCount === 1 ? 'member' : 'members'}.
      </p>

      <div className="flex items-center gap-2.5 bg-purple-50 border-[1.5px] border-[#E8E4F5] rounded-[14px] px-4 py-3.5 mb-3.5">
        <span className="flex-1 font-sans text-[14px] text-ink-900 truncate">
          {loading ? 'Loading…' : (url ?? 'Link unavailable')}
        </span>
        <button
          onClick={() => void handleCopy()}
          disabled={!url}
          className="shrink-0 font-sans text-[13px] font-bold text-purple-500 disabled:opacity-40"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <button
        onClick={() => void handleShare()}
        disabled={!url}
        className="w-full py-4 rounded-2xl bg-purple-500 text-white font-display font-extrabold text-[16px] tracking-tight flex items-center justify-center gap-2 disabled:opacity-50 mb-3.5"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        Share link
      </button>

      <button
        onClick={() => void handleReset()}
        disabled={resetting || !url}
        className="block w-full text-center font-sans text-[13px] font-semibold text-ink-500 disabled:opacity-40"
      >
        {resetting ? 'Resetting…' : (
          <>
            Reset link <span className="text-red-500">· the old one stops working</span>
          </>
        )}
      </button>
    </Sheet>
  )
}
