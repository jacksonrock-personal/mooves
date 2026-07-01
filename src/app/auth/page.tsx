'use client'

// Screen 2a: Phone Number Entry
// Mockup: mooves-screen2-auth.html

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth'
import { firebaseAuth } from '@/lib/firebase/client'
import { storeConfirmationResult } from '@/lib/auth/otp-state'
import { initPostHog, posthog } from '@/lib/posthog'

function formatPhone(digits: string): string {
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

function AuthContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get('invite')

  const [rawDigits, setRawDigits] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFocused, setIsFocused] = useState(false)

  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null)
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null)

  function initRecaptcha() {
    if (!recaptchaContainerRef.current) return
    recaptchaVerifierRef.current?.clear()
    recaptchaVerifierRef.current = new RecaptchaVerifier(
      firebaseAuth,
      recaptchaContainerRef.current,
      { size: 'invisible' },
    )
  }

  useEffect(() => {
    initPostHog()
    initRecaptcha()
    return () => {
      recaptchaVerifierRef.current?.clear()
      recaptchaVerifierRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit() {
    if (rawDigits.length !== 10 || isLoading) return
    setIsLoading(true)
    setError(null)

    try {
      if (!recaptchaVerifierRef.current) initRecaptcha()
      const fullPhone = `+1${rawDigits}`
      const result = await signInWithPhoneNumber(
        firebaseAuth,
        fullPhone,
        recaptchaVerifierRef.current!,
      )
      storeConfirmationResult(result)
      sessionStorage.setItem('mooves_otp_phone', fullPhone)
      posthog.capture('auth_phone_submitted')
      router.push(inviteCode ? `/auth/otp?invite=${inviteCode}` : '/auth/otp')
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      setError(
        code === 'auth/too-many-requests'
          ? 'Too many attempts, try again in a few minutes.'
          : 'Something went wrong, please try again.',
      )
      initRecaptcha()
      setIsLoading(false)
    }
  }

  const canSubmit = rawDigits.length === 10 && !isLoading

  return (
    <main className="min-h-screen bg-surface-bg flex flex-col">
      <div ref={recaptchaContainerRef} id="recaptcha-container" />

      {/* Nav */}
      <div className="flex items-center justify-between px-6 pt-12">
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          className="text-mooves-purple"
        >
          <span className="text-2xl leading-none">‹</span>
        </button>
        <MoovesWordmark />
        <div className="w-6" />
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col px-7 pt-10">
        <h1 className="font-display font-extrabold text-[28px] text-text-primary tracking-tight leading-[1.15] mb-2.5">
          What's your<br />number?
        </h1>
        <p className="font-sans text-[15px] text-text-secondary leading-relaxed mb-9">
          We'll text you a code to verify it's you.
        </p>

        <div
          className={`flex items-center bg-card-white rounded-2xl px-4 h-[60px] gap-2.5 border-2 transition-colors ${
            isFocused
              ? 'border-mooves-purple shadow-[0_0_0_4px_rgba(124,92,219,0.1)]'
              : 'border-[#E8E4F5]'
          }`}
        >
          <span className="font-sans text-base font-medium text-text-secondary whitespace-nowrap flex-shrink-0">
            🇺🇸 +1
          </span>
          <div className="w-px h-6 bg-[#E8E4F5] flex-shrink-0" />
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={formatPhone(rawDigits)}
            onChange={e => {
              setRawDigits(e.target.value.replace(/\D/g, '').slice(0, 10))
              if (error) setError(null)
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={e => { if (e.key === 'Enter' && canSubmit) void handleSubmit() }}
            placeholder="(555) 555-5555"
            className="flex-1 bg-transparent border-none outline-none font-sans text-lg font-medium text-text-primary placeholder:text-status-grey placeholder:font-normal"
          />
        </div>

        {error && (
          <p className="mt-2 font-sans text-[13px] text-[#E8405A]">{error}</p>
        )}
      </div>

      {/* ToS + CTA */}
      <p className="font-sans text-[11px] text-text-secondary text-center leading-relaxed px-7 mb-5">
        By continuing, you agree to our{' '}
        <a href="#" className="text-mooves-purple font-medium">Terms</a>
        {' '}and{' '}
        <a href="#" className="text-mooves-purple font-medium">Privacy Policy</a>.
      </p>
      <div className="px-7 pb-11">
        <button
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          className="w-full py-[17px] rounded-2xl bg-mooves-purple text-white font-display font-extrabold text-[17px] tracking-tight disabled:opacity-[0.35] disabled:cursor-default transition-opacity"
        >
          {isLoading ? 'Sending…' : 'Send code'}
        </button>
      </div>
    </main>
  )
}

function MoovesWordmark() {
  return (
    <div className="font-display font-extrabold text-base text-text-primary tracking-tight flex items-center">
      M
      <span className="inline-block w-2.5 h-2.5 rounded-full bg-status-green relative top-px" />
      <span className="inline-block w-2.5 h-2.5 rounded-full bg-status-grey mr-px relative top-px" />
      VES
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthContent />
    </Suspense>
  )
}
