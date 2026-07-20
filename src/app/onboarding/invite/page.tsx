'use client'

// Screen 3b: Invite Nudge
// Mockup: mooves-screen3-onboarding.html

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog'

function InviteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get('invite')

  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [canShare, setCanShare] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setCanShare('share' in navigator)

    fetch('/api/users/me')
      .then(r => r.json())
      .then((data: { referralCode?: string }) => {
        if (data.referralCode) setReferralCode(data.referralCode)
      })
  }, [])

  const shareUrl = referralCode
    ? `https://makemooves.app/join/${referralCode}`
    : null

  async function completeOnboarding() {
    setIsLoading(true)
    await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboardingComplete: true }),
    })
    posthog.capture('onboarding_completed')

    // If arriving via invite link, navigate to feed — feed handles friendship creation
    router.replace(inviteCode ? `/feed?invite=${inviteCode}` : '/feed')
  }

  async function handleShare() {
    if (!shareUrl) return
    posthog.capture('onboarding_invite_tapped')

    if (canShare) {
      try {
        await navigator.share({
          title: 'Join me on Mooves',
          text: 'See when your friends are free, without having to ask.',
          url: shareUrl,
        })
        posthog.capture('onboarding_invite_shared')
        void completeOnboarding()
      } catch {
        // User dismissed share sheet — stay on screen, no event
      }
    } else {
      // Desktop clipboard fallback
      try {
        await navigator.clipboard.writeText(shareUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        // silent
      }
    }
  }

  function handleSkip() {
    posthog.capture('onboarding_invite_skipped')
    void completeOnboarding()
  }

  return (
    <main className="min-h-screen bg-surface-bg flex flex-col">
      {/* Step dots — step 3 of 3 */}
      <div className="flex gap-1.5 justify-center pt-12">
        <div className="w-2 h-2 rounded-full bg-mooves-purple" />
        <div className="w-2 h-2 rounded-full bg-mooves-purple" />
        <div className="w-2 h-2 rounded-full bg-mooves-purple" />
      </div>

      {/* Body — vertically centered */}
      <div className="flex-1 flex flex-col items-center justify-center px-7">
        {/* Share icon */}
        <div className="w-20 h-20 rounded-full bg-purple-tint flex items-center justify-center mb-6">
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#7C5CDB"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        </div>

        <h1 className="font-display font-extrabold text-[28px] text-text-primary tracking-tight text-center mb-2.5">
          Bring your friends.
        </h1>
        <p className="font-sans text-[15px] text-text-secondary text-center leading-relaxed mb-7">
          Mooves is only as good as<br />the people on it.
        </p>

        {shareUrl && (
          <div className="bg-purple-tint rounded-full px-[18px] py-2.5 font-sans text-[13px] font-semibold text-mooves-purple tracking-tight select-all">
            {shareUrl.replace('https://', '')}
          </div>
        )}
      </div>

      {/* CTAs */}
      <div className="px-7 pb-11">
        <button
          onClick={() => void handleShare()}
          disabled={isLoading || !shareUrl}
          className="w-full py-[17px] rounded-2xl bg-mooves-purple text-white font-display font-extrabold text-[17px] tracking-tight disabled:opacity-30 disabled:cursor-default transition-opacity mb-4"
        >
          {copied ? 'Copied!' : canShare ? 'Share your link' : 'Copy link'}
        </button>
        <button
          onClick={handleSkip}
          disabled={isLoading}
          className="block w-full text-center font-sans text-sm font-medium text-text-secondary disabled:opacity-50"
        >
          Skip for now
        </button>
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
