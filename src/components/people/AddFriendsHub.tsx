'use client'

// Phase 19 — the Add friends screen. Holds both paths:
//   19.1 "Add everyone here" — one code for a whole room, creates NO group
//   19.2 your personal QR    — the existing referral link, made scannable
//
// It also absorbs the old "Invite friends" share action from the Friends tab,
// so there is one entry with three paths ordered by what they deliver, rather
// than two competing invite buttons in the same sticky bar.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { initPostHog, posthog } from '@/lib/posthog'
import type { RoundupSessionData } from '@/lib/roundup'
import CowIllustration from '@/components/ui/CowIllustration'
import QrCode from '@/components/ui/QrCode'
import Toast from '@/components/ui/Toast'
import RoundupSession from './RoundupSession'

type View =
  | { kind: 'loading' }
  | { kind: 'hub' }
  | { kind: 'session'; session: RoundupSessionData }
  | { kind: 'closed'; addedCount: number }
  | { kind: 'expired'; joinedCount: number }

export default function AddFriendsHub() {
  const router = useRouter()
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      initPostHog()
      posthog.capture('add_friends_viewed')

      const [sessionRes, me] = await Promise.all([
        fetch('/api/roundups').then(r => r.json()) as Promise<{
          session: RoundupSessionData | null
          expired: { joinedCount: number } | null
        }>,
        fetch('/api/users/me').then(r => r.json()) as Promise<{ referralCode?: string }>,
      ])
      if (cancelled) return

      setReferralCode(me.referralCode ?? null)
      // An open session resumes where it left off. One that ran out while the
      // host was away says so, rather than dropping them on the hub with no
      // explanation of where their code went.
      if (sessionRes.session) setView({ kind: 'session', session: sessionRes.session })
      else if (sessionRes.expired)
        setView({ kind: 'expired', joinedCount: sessionRes.expired.joinedCount })
      else setView({ kind: 'hub' })
    }

    void init()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleStart() {
    if (starting) return
    setStarting(true)
    try {
      const res = await fetch('/api/roundups', { method: 'POST' })
      if (!res.ok) {
        setToast("Couldn't start that, try again.")
        setStarting(false)
        return
      }
      const data = (await res.json()) as { session: RoundupSessionData }
      posthog.capture('roundup_started')
      setView({ kind: 'session', session: data.session })
    } catch {
      setToast("Couldn't start that, try again.")
    } finally {
      setStarting(false)
    }
  }

  async function handleShareLink() {
    if (!referralCode) return
    posthog.capture('friends_invite_tapped')
    const shareUrl = `https://makemooves.app/join/${referralCode}`
    // Hoisted, not inlined into the `if`: testing `'share' in navigator`
    // directly narrows navigator to `never` in the else branch.
    const canShare = typeof navigator !== 'undefined' && 'share' in navigator
    if (canShare) {
      try {
        await navigator.share({
          title: 'Join me on Mooves',
          text: 'See when your friends are free, without having to ask.',
          url: shareUrl,
        })
      } catch {
        // dismissed — no-op
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl)
        setToast('Copied!')
      } catch {
        // silent
      }
    }
  }

  const title =
    view.kind === 'session' ? 'Adding everyone here' : 'Add friends'

  return (
    <div className="min-h-screen flex flex-col bg-purple-50">
      <header className="bg-card-white border-b border-[#E8E4F5] px-4 pt-[46px] pb-3 flex items-center shrink-0">
        <button
          onClick={() => (view.kind === 'session' ? undefined : router.push('/people'))}
          className={`min-w-10 flex items-center text-mooves-purple ${
            view.kind === 'session' ? 'invisible' : ''
          }`}
          aria-label="Back"
        >
          <svg width="9" height="15" viewBox="0 0 9 15" fill="none">
            <path
              d="M8 1L1.5 7.5L8 14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h1 className="flex-1 text-center font-display font-extrabold text-[16px] text-text-primary tracking-tight">
          {title}
        </h1>
        <span className="min-w-10" />
      </header>

      {view.kind === 'session' ? (
        <RoundupSession
          session={view.session}
          onClosed={addedCount => setView({ kind: 'closed', addedCount })}
        />
      ) : view.kind === 'closed' ? (
        <ClosedConfirmation addedCount={view.addedCount} onDone={() => router.push('/people')} />
      ) : view.kind === 'loading' ? (
        <div className="flex-1" />
      ) : view.kind === 'expired' ? (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="bg-card-white border border-[#E8E4F5] rounded-[20px] px-5 py-6 text-center">
            <CowIllustration size={66} className="mx-auto mb-3.5" />
            <h2 className="font-display font-extrabold text-[18px] text-text-primary tracking-tight mb-[7px]">
              That code expired
            </h2>
            <p className="font-sans text-[13px] text-text-secondary leading-relaxed mb-[17px]">
              Codes stop working after 24 hours.
              {view.joinedCount > 0 &&
                ` The ${view.joinedCount} ${
                  view.joinedCount === 1 ? 'person who joined is' : 'people who joined are'
                } still your ${view.joinedCount === 1 ? 'friend' : 'friends'}.`}
            </p>
            <button
              onClick={() => void handleStart()}
              disabled={starting}
              className="w-full py-[15px] rounded-2xl bg-mooves-purple text-white font-display font-extrabold text-[15.5px] tracking-tight shadow-[0_6px_18px_rgba(124,92,219,0.3)] disabled:opacity-50"
            >
              Add everyone here
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {/* 19.1 — the in-person path, visually dominant */}
          <div className="bg-card-white border-[1.5px] border-mooves-purple rounded-[20px] px-4 py-[18px] shadow-[0_6px_20px_rgba(124,92,219,0.1)]">
            <p className="font-sans text-[10.5px] font-bold uppercase tracking-[0.1em] text-mooves-purple mb-[7px]">
              In the room
            </p>
            <h2 className="font-display font-extrabold text-[18px] text-text-primary tracking-tight mb-[7px]">
              Add everyone here
            </h2>
            <p className="font-sans text-[13px] text-text-secondary leading-relaxed mb-[15px]">
              Everyone who scans this code gets added as friends with each other, not just to you.
              No formal group gets created.
            </p>
            <button
              onClick={() => void handleStart()}
              disabled={starting}
              className="w-full py-[15px] rounded-2xl bg-mooves-purple text-white font-display font-extrabold text-[15.5px] tracking-tight shadow-[0_6px_18px_rgba(124,92,219,0.3)] disabled:opacity-50"
            >
              Show the code
            </button>
          </div>

          {/* 19.2 — the 1:1 path */}
          <div className="bg-card-white border border-[#E8E4F5] rounded-[20px] px-4 py-[18px]">
            <h2 className="font-display font-bold text-[14px] text-text-primary tracking-tight mb-1">
              Your own code
            </h2>
            <p className="font-sans text-[13px] text-text-secondary leading-relaxed mb-3.5">
              For adding one person. This is your personal link, it never expires.
            </p>
            {referralCode ? (
              <div className="flex justify-center">
                <QrCode
                  value={`https://makemooves.app/join/${referralCode}`}
                  size={112}
                  label="Your personal code"
                />
              </div>
            ) : (
              <div className="h-[132px]" />
            )}
            <button
              onClick={() => void handleShareLink()}
              className="w-full mt-[15px] py-3 rounded-2xl bg-surface-bg text-text-secondary font-sans font-semibold text-[14px] flex items-center justify-center gap-2"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              Share your link instead
            </button>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  )
}

function ClosedConfirmation({
  addedCount,
  onDone,
}: {
  addedCount: number
  onDone: () => void
}) {
  return (
    <>
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20 text-center">
        <CowIllustration size={66} className="mb-4" />
        <h2 className="font-display font-extrabold text-[21px] text-text-primary tracking-tight mb-2">
          {addedCount === 0
            ? 'Nobody joined this time.'
            : `You added ${addedCount} ${addedCount === 1 ? 'person' : 'people'}.`}
        </h2>
        <p className="font-sans text-[13px] text-text-secondary leading-relaxed max-w-[250px]">
          {addedCount === 0
            ? 'No harm done, nothing was created. Start another one whenever you need it.'
            : "They're all friends with each other now, and with you. Nothing else was created, there's no new group to manage."}
        </p>
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-card-white border-t border-[#E8E4F5] px-4 pt-3 [--safe-pb-base:1.25rem] safe-area-pb">
        <button
          onClick={onDone}
          className="w-full py-[15px] rounded-2xl bg-mooves-purple text-white font-display font-extrabold text-[15.5px] tracking-tight shadow-[0_6px_18px_rgba(124,92,219,0.3)]"
        >
          Back to friends
        </button>
      </div>
    </>
  )
}
