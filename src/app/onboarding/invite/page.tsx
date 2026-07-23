'use client'

// Screen 3b: Invite — group-first CTA (Phase 17.4).
// Mockup: mooves-phase17-wave-stance.html
//
// The one action at the end of setup: create a group and drop its link in your
// group chat. The name is pre-filled "Group Chat" and auto-selected so the first
// keystroke renames it. The real group is created LAZILY, only on Copy/Share (a
// skip creates nothing). Replaces the old personal-referral invite link.

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog'

const DEFAULT_NAME = 'Group Chat'
const GROUP_EMOJI = '💬'

function InviteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get('invite')

  const [name, setName] = useState(DEFAULT_NAME)
  const [linkUrl, setLinkUrl] = useState<string | null>(null)
  const [canShare, setCanShare] = useState(false)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const urlRef = useRef<string | null>(null)
  const renamedRef = useRef(false)

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && 'share' in navigator)
    posthog.capture('onboarding_group_prefilled_viewed')
    // Auto-focus + select the stock name so the first keystroke overwrites it.
    const el = inputRef.current
    if (el) {
      el.focus()
      el.select()
    }
  }, [])

  function goToLoop() {
    router.replace(inviteCode ? `/onboarding/loop?invite=${inviteCode}` : '/onboarding/loop')
  }

  function onNameChange(value: string) {
    setName(value)
    if (!renamedRef.current) {
      renamedRef.current = true
      posthog.capture('onboarding_group_renamed')
    }
  }

  // Lazily create the group + its invite link on first Copy/Share; reuse after.
  async function ensureGroupUrl(): Promise<string | null> {
    if (urlRef.current) return urlRef.current
    const groupName = name.trim() || DEFAULT_NAME
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: groupName, emoji: GROUP_EMOJI }),
    })
    if (!res.ok) return null
    const group = (await res.json()) as { id: string }
    const invite = (await fetch(`/api/groups/${group.id}/invite`).then(r => r.json())) as { url?: string }
    const url = invite.url ?? null
    urlRef.current = url
    setLinkUrl(url)
    return url
  }

  async function handleCopy() {
    if (busy) return
    setBusy(true)
    try {
      const url = await ensureGroupUrl()
      if (!url) return
      await navigator.clipboard.writeText(url)
      setCopied(true)
      posthog.capture('onboarding_group_link_copied')
      setTimeout(goToLoop, 1200)
    } catch {
      // clipboard blocked or create failed — stay on screen
    } finally {
      setBusy(false)
    }
  }

  async function handleShare() {
    if (busy) return
    setBusy(true)
    try {
      const url = await ensureGroupUrl()
      if (!url) return
      if (canShare) {
        await navigator.share({ title: 'Join my group on Mooves', url })
        posthog.capture('onboarding_group_link_shared')
        goToLoop()
      } else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        posthog.capture('onboarding_group_link_copied')
        setTimeout(goToLoop, 1200)
      }
    } catch {
      // user dismissed the share sheet — stay on screen
    } finally {
      setBusy(false)
    }
  }

  function handleSkip() {
    posthog.capture('onboarding_group_invite_skipped')
    goToLoop()
  }

  return (
    <main className="min-h-screen bg-surface-bg flex flex-col">
      {/* Step dots — step 4 of 4 */}
      <div className="flex gap-1.5 justify-center pt-12">
        <div className="w-2 h-2 rounded-full bg-mooves-purple" />
        <div className="w-2 h-2 rounded-full bg-mooves-purple" />
        <div className="w-2 h-2 rounded-full bg-mooves-purple" />
        <div className="w-2 h-2 rounded-full bg-mooves-purple" />
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center px-7 pt-8">
        <div className="w-[72px] h-[72px] rounded-[20px] bg-purple-tint flex items-center justify-center mb-5">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#7C5CDB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>

        <h1 className="font-display font-extrabold text-[26px] text-text-primary tracking-tight text-center leading-[1.15] mb-2">
          Get your friends<br />on Mooves.
        </h1>
        <p className="font-sans text-[15px] text-text-secondary text-center leading-relaxed mb-6">
          Name your group chat, then drop the link in it.
        </p>

        <div className="w-full">
          <label htmlFor="group-name" className="block font-sans text-[12px] font-semibold text-text-secondary uppercase tracking-[0.04em] mb-2">
            Group name
          </label>
          <input
            id="group-name"
            ref={inputRef}
            value={name}
            onChange={e => onNameChange(e.target.value)}
            maxLength={40}
            className="w-full h-14 rounded-[14px] border-2 border-mooves-purple bg-white px-4 font-sans text-[17px] font-semibold text-text-primary outline-none"
          />
          <p className="font-sans text-[12.5px] text-text-secondary mt-2">
            Rename it whatever you all call it. Start typing to replace.
          </p>
        </div>

        {linkUrl && (
          <div className="w-full mt-5 flex items-center gap-2.5 bg-surface-bg border-[1.5px] border-dashed border-[#E8E4F5] rounded-[12px] px-3.5 py-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C5CDB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <span className="flex-1 font-sans text-[13.5px] font-semibold text-mooves-purple truncate">
              {linkUrl.replace('https://', '')}
            </span>
          </div>
        )}

        <p className="font-display font-extrabold text-[16px] text-text-primary tracking-tight text-center leading-snug mt-6 px-1">
          Drop this in the group chat and<br />get your friends on.
        </p>
      </div>

      {/* CTAs */}
      <div className="px-7 pb-9 pt-4">
        <button
          onClick={() => void handleCopy()}
          disabled={busy}
          className="w-full py-[17px] rounded-2xl bg-mooves-purple text-white font-display font-extrabold text-[17px] tracking-tight flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
        >
          {copied ? (
            'Copied'
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy invite link
            </>
          )}
        </button>
        <button
          onClick={() => void handleShare()}
          disabled={busy}
          className="w-full mt-2.5 py-3.5 rounded-2xl border-[1.5px] border-[#E8E4F5] bg-white text-mooves-purple font-display font-extrabold text-[15px] tracking-tight disabled:opacity-50"
        >
          Share
        </button>
        <button
          onClick={handleSkip}
          disabled={busy}
          className="block w-full text-center mt-4 font-sans text-sm font-semibold text-text-secondary disabled:opacity-50"
        >
          Skip for now
        </button>
        <p className="text-center font-sans text-[12px] text-status-grey mt-1.5">
          Mooves is quiet without your people.
        </p>
      </div>
    </main>
  )
}

export default function OnboardingInvitePage() {
  return (
    <Suspense>
      <InviteContent />
    </Suspense>
  )
}
