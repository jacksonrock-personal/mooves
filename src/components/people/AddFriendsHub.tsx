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
  const [showPersonal, setShowPersonal] = useState(false)

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
        // 24.1 — ONE question, three answers.
        //
        // This screen used to present three artifacts (a room code, a personal
        // QR, a link) and ask the user to pick between them. That is a question
        // about the app's data model, asked at the moment they have the least
        // context for it. Now it asks a fact about their own life, which anyone
        // can answer instantly, and the app picks the artifact.
        //
        // Nothing was built and nothing was removed. The three paths are the
        // three that already existed, ordered by yield: in-person is highest
        // when it applies and it is time-sensitive, the group chat is the only
        // bulk mechanism that works remotely, one person is the long tail.
        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="font-display font-extrabold text-[20px] text-text-primary tracking-tight leading-[1.2] px-0.5 pt-2 pb-1">
            Where are your people
            <br />
            right now?
          </h2>
          <p className="font-sans text-[13px] text-text-secondary leading-relaxed px-0.5 pb-4">
            All three work. This just picks the one that fits.
          </p>

          <button
            onClick={() => void handleStart()}
            disabled={starting}
            className="w-full flex items-start gap-[13px] bg-card-white border-[1.5px] border-[#E8E4F5] rounded-[18px] p-[15px] text-left mb-2.5 disabled:opacity-50"
          >
            <span className="shrink-0 w-[42px] h-[42px] rounded-[13px] bg-purple-100 flex items-center justify-center text-purple-700">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <path d="M14 17.5h7M17.5 14v7" />
              </svg>
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-display font-extrabold text-[15.5px] text-text-primary tracking-tight">
                In this room
              </span>
              <span className="block font-sans text-[12.5px] text-text-secondary leading-[1.45] mt-[3px]">
                Everyone scans one code and comes out friends with each other.
              </span>
            </span>
          </button>

          <button
            onClick={() => {
              posthog.capture('add_friends_path', { path: 'group' })
              router.push('/people/groups/new')
            }}
            className="w-full flex items-start gap-[13px] bg-card-white border-[1.5px] border-[#E8E4F5] rounded-[18px] p-[15px] text-left mb-2.5"
          >
            <span className="shrink-0 w-[42px] h-[42px] rounded-[13px] bg-purple-100 flex items-center justify-center text-purple-700">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-4-.9L3 21l1.9-4.9A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4Z" />
              </svg>
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-display font-extrabold text-[15.5px] text-text-primary tracking-tight">
                In a group chat
              </span>
              <span className="block font-sans text-[12.5px] text-text-secondary leading-[1.45] mt-[3px]">
                Name your crew, drop the link in. Everyone who taps it becomes friends with everyone
                else, not just with you.
              </span>
            </span>
          </button>

          {/* 19.2 survives intact — it just stopped being a competing headline.
              Expanding rather than routing keeps the QR one tap away for the
              in-person 1:1 case without adding a fourth answer to the question. */}
          <button
            onClick={() => setShowPersonal(v => !v)}
            aria-expanded={showPersonal}
            className="w-full flex items-start gap-[13px] bg-card-white border-[1.5px] border-[#E8E4F5] rounded-[18px] p-[15px] text-left"
          >
            <span className="shrink-0 w-[42px] h-[42px] rounded-[13px] bg-purple-100 flex items-center justify-center text-purple-700">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M5 20a7 7 0 0 1 14 0" />
              </svg>
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-display font-extrabold text-[15.5px] text-text-primary tracking-tight">
                Just one person
              </span>
              <span className="block font-sans text-[12.5px] text-text-secondary leading-[1.45] mt-[3px]">
                Your personal link. It never expires.
              </span>
            </span>
          </button>

          {showPersonal && (
            <div className="bg-card-white border border-[#E8E4F5] border-t-0 rounded-b-[18px] px-4 pb-4 -mt-[18px] pt-[22px]">
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
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
                Share your link
              </button>
            </div>
          )}
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
