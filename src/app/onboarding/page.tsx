'use client'

// Screen 3a: Profile Setup
// Mockup: mooves-screen3-onboarding.html
// R38: mooves-r38-onboarding-refresh.html (state 5). Step 1 of 4 on the cold
// path, 1 of 2 on the invited path, and the invited path names the cow here
// because it never sees the reveal.

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { posthog } from '@/lib/posthog'
import CowDisc from '@/components/onboarding/CowDisc'
import { COLD_STEPS, INVITED_STEPS, StepDots, StepEyebrow } from '@/components/onboarding/StepProgress'

function OnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get('invite')

  // 24.2 — "invited" means ANY way in that comes with friends attached, not just
  // a personal link. Group links (Phase 10.2) and "add everyone here" codes
  // (Phase 19.1) carry their code through auth in sessionStorage, not the URL,
  // and the feed completes those joins from there. Checking only `?invite=`
  // sent group joiners through the cold flow — rehearsing a green nobody sees,
  // then being told to create a group seconds after joining one.
  function arrivedInvited(): boolean {
    if (inviteCode) return true
    try {
      return (
        !!sessionStorage.getItem('mooves_group_invite_code') ||
        !!sessionStorage.getItem('mooves_roundup_code')
      )
    } catch {
      return false
    }
  }
  const invitedFeedUrl = inviteCode ? `/feed?invite=${inviteCode}` : '/feed'

  // R38 — the invited path is profile → text alerts → feed. The alerts step is
  // now the true end, so IT marks onboarding complete (awaited, before routing
  // to the feed), not this page. `path=invited` tells it which counter to
  // show; the invite code rides along so the feed can complete the friendship.
  // Group / roundup codes stay in sessionStorage, where the feed reads them.
  const invitedAlertsUrl = `/onboarding/alerts?path=invited${inviteCode ? `&invite=${inviteCode}` : ''}`
  function goInvitedAlerts(replace = false) {
    if (replace) router.replace(invitedAlertsUrl)
    else router.push(invitedAlertsUrl)
  }

  // Which path this is, for the counter and the cow line. sessionStorage is
  // client-only, so it is resolved after mount; until then the counter is
  // held invisible rather than flashing the wrong total.
  const [invited, setInvited] = useState<boolean | null>(inviteCode ? true : null)
  const stepCount = invited ? INVITED_STEPS : COLD_STEPS

  const [name, setName] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [supabaseToken, setSupabaseToken] = useState<string | null>(null)

  useEffect(() => {
    setInvited(arrivedInvited())

    // Resume logic: if display_name already set, skip to step 3b
    fetch('/api/users/me')
      .then(r => r.json())
      .then((data: { onboardingComplete?: boolean; displayName?: string | null }) => {
        if (data.onboardingComplete) {
          router.replace(invitedFeedUrl)
          return
        }
        if (data.displayName) {
          if (arrivedInvited()) goInvitedAlerts(true)
          else router.replace('/onboarding/free')
        }
      })

    // Supabase JWT for storage uploads
    fetch('/api/auth/supabase-token')
      .then(r => r.json())
      .then((d: { token: string; userId: string }) => {
        setSupabaseToken(d.token)
        setUserId(d.userId)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setPhotoError(null)
  }

  async function uploadPhoto(file: File, uid: string, token: string): Promise<string> {
    const supabase = createClient(token)
    const ext = file.type.includes('png') ? 'png' : 'jpg'
    const path = `${uid}/avatar.${ext}`
    const { error } = await supabase.storage
      .from('Avatars')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) throw error
    const { data: { publicUrl } } = supabase.storage.from('Avatars').getPublicUrl(path)
    return publicUrl
  }

  async function handleContinue() {
    const trimmed = name.trim()
    if (!trimmed || isLoading) return
    setIsLoading(true)
    setPhotoError(null)

    let avatarUrl: string | undefined

    if (photoFile && supabaseToken && userId) {
      try {
        avatarUrl = await uploadPhoto(photoFile, userId, supabaseToken)
        posthog.capture('onboarding_photo_added')
      } catch {
        setPhotoError("Couldn't upload photo, try again.")
        setIsLoading(false)
        return
      }
    } else {
      posthog.capture('onboarding_photo_skipped')
    }

    posthog.capture('onboarding_name_entered')

    const body: { displayName: string; avatarUrl?: string } = { displayName: trimmed }
    if (avatarUrl) body.avatarUrl = avatarUrl

    const res = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      setPhotoError('Something went wrong, try again.')
      setIsLoading(false)
      return
    }

    // 24.2 — the invited user skips the rehearsal and the crew step.
    //
    // They arrived through a friend or a group link, so they ALREADY have
    // friends and their feed is not empty. Asking them to rehearse a green
    // nobody can see, and then to build a community they have just joined, is
    // the wasteful version of the best-converting cohort there is.
    //
    // R37/R38 — one step remains: text alerts, then the feed.
    // The recruit ask reaches them later, on their own terms (24.3).
    if (arrivedInvited()) {
      goInvitedAlerts()
      return
    }
    router.push('/onboarding/free')
  }

  const initials = name.trim() ? name.trim()[0].toUpperCase() : ''
  const canContinue = name.trim().length > 0 && !isLoading

  return (
    <main className="min-h-screen bg-surface-bg flex flex-col">
      {/* Body */}
      <div className="flex-1 flex flex-col items-center px-7 pt-[calc(env(safe-area-inset-top)+3.5rem)]">
        <div className={invited === null ? 'invisible' : ''}>
          <StepEyebrow index={1} count={stepCount} />
        </div>
        <h1 className="font-display font-extrabold text-[26px] text-text-primary tracking-tight leading-[1.15] text-center mb-2 w-full">
          What should we<br />call you?
        </h1>
        <p className="font-sans text-[15px] text-text-secondary leading-relaxed text-center mb-9 w-full">
          This is how your friends will see you.
        </p>

        {/* Photo upload */}
        <label
          htmlFor="photo-input"
          className="flex flex-col items-center gap-2.5 mb-8 cursor-pointer"
        >
          <div
            className={`w-[88px] h-[88px] rounded-full flex items-center justify-center relative transition-all ${
              photoPreview
                ? 'border-[3px] border-mooves-purple overflow-hidden'
                : 'bg-purple-tint border-2 border-dashed border-mooves-purple'
            }`}
          >
            {photoPreview ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoPreview}
                  alt="Your photo"
                  className="w-full h-full object-cover rounded-full"
                />
                <div className="absolute bottom-0.5 right-0.5 w-6 h-6 rounded-full bg-mooves-purple border-2 border-surface-bg flex items-center justify-center">
                  <CameraIcon size={11} color="white" />
                </div>
              </>
            ) : initials ? (
              <span className="font-display font-extrabold text-[22px] text-mooves-purple">
                {initials}
              </span>
            ) : (
              <CameraIcon size={28} color="#7C5CDB" className="opacity-60" />
            )}
          </div>
          <span className="font-sans text-[13px] font-semibold text-mooves-purple">
            {photoPreview ? 'Change photo' : 'Add a photo'}
          </span>
        </label>
        <input
          id="photo-input"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Name input */}
        <div className="w-full">
          <label
            htmlFor="name-input"
            className="block font-sans text-[12px] font-semibold text-text-secondary uppercase tracking-[0.04em] mb-2"
          >
            Your name
          </label>
          <input
            id="name-input"
            type="text"
            value={name}
            onChange={e => setName(e.target.value.slice(0, 30))}
            autoCapitalize="words"
            placeholder="e.g. Jackson"
            className={`w-full h-14 rounded-2xl border-2 bg-card-white px-4 font-sans text-[17px] font-medium text-text-primary placeholder:text-status-grey placeholder:font-normal outline-none transition-colors focus:border-mooves-purple focus:shadow-[0_0_0_4px_rgba(124,92,219,0.1)] ${
              name ? 'border-mooves-purple' : 'border-[#E8E4F5]'
            }`}
          />
        </div>

        {photoError && (
          <p className="mt-3 font-sans text-[13px] text-[#E8405A] w-full">
            {photoError}
          </p>
        )}

        {/* R38 — the invited path never sees the reveal, so the cow is named
            here, the last thing read before Continue. */}
        {invited && (
          <div className="flex items-center justify-center gap-3 mt-6 w-full">
            <CowDisc size={38} />
            <p className="font-sans text-[13.5px] font-semibold text-ink-900 leading-snug">
              Tap the cow to plan a Moove.
            </p>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="px-7 pb-11 pt-3.5">
        <div className={invited === null ? 'invisible' : ''}>
          <StepDots index={1} count={stepCount} />
        </div>
        <button
          onClick={() => void handleContinue()}
          disabled={!canContinue}
          className="w-full py-[17px] rounded-2xl bg-mooves-purple text-white font-display font-extrabold text-[17px] tracking-tight disabled:opacity-30 disabled:cursor-default transition-opacity"
        >
          {isLoading ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </main>
  )
}

function CameraIcon({
  size = 24,
  color = 'currentColor',
  className = '',
}: {
  size?: number
  color?: string
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingContent />
    </Suspense>
  )
}
