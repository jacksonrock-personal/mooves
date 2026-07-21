'use client'

// Screen 2a: Phone Number Entry
// Mockup: mooves-screen2-auth.html

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth'
import { firebaseAuth } from '@/lib/firebase/client'
import { storeConfirmationResult } from '@/lib/auth/otp-state'
import { initPostHog, posthog } from '@/lib/posthog'
import Wordmark from '@/components/ui/Wordmark'

function formatPhone(digits: string): string {
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

// Reduce any input (typed or autofilled) to a clean 10-digit national number.
// iOS autofill / Contacts commonly supplies the number with its +1 country code
// (or a bare leading 1). NANP area codes never start with 1, so an 11-digit value
// beginning with 1 is always country-code-prefixed — strip it, otherwise the naive
// slice(0,10) keeps the 1 and drops the last real digit.
function normalizeUSDigits(input: string): string {
  const digits = input.replace(/\D/g, '')
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  return national.slice(0, 10)
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
    // clear() doesn't reliably remove the rendered widget from the container,
    // so a subsequent verify() throws "reCAPTCHA has already been rendered in
    // this element". Empty the node so each attempt renders into a clean element.
    recaptchaContainerRef.current.innerHTML = ''
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
      // Surface the real failure so production auth errors are diagnosable
      // instead of hidden behind the generic user-facing message below.
      console.error('[auth] signInWithPhoneNumber failed:', code || '(no code)', err)
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
    <main className="min-h-screen bg-purple-50 flex flex-col">
      <div ref={recaptchaContainerRef} id="recaptcha-container" />

      {/* Nav */}
      <div className="flex items-center justify-between px-6 pt-12">
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          className="text-purple-500"
        >
          <span className="text-2xl leading-none">‹</span>
        </button>
        <Wordmark variant="dark" withCow />
        <div className="w-6" />
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col px-7 pt-10">
        <h1 className="font-display font-extrabold text-[28px] text-ink-900 tracking-tight leading-[1.15] mb-2.5">
          What's your<br />number?
        </h1>
        <p className="font-sans text-[15px] text-ink-500 leading-relaxed mb-9">
          We'll text you a code to verify it's you.
        </p>

        <div
          className={`flex items-center bg-white rounded-2xl px-4 h-[60px] gap-2.5 border-2 transition-colors ${
            isFocused
              ? 'border-purple-500 shadow-[0_0_0_4px_rgba(124,92,219,0.1)]'
              : 'border-[#E8E4F5]'
          }`}
        >
          <span className="font-sans text-base font-medium text-ink-500 whitespace-nowrap flex-shrink-0">
            🇺🇸 +1
          </span>
          <div className="w-px h-6 bg-[#E8E4F5] flex-shrink-0" />
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={formatPhone(rawDigits)}
            onChange={e => {
              setRawDigits(normalizeUSDigits(e.target.value))
              if (error) setError(null)
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={e => { if (e.key === 'Enter' && canSubmit) void handleSubmit() }}
            placeholder="(555) 555-5555"
            className="flex-1 bg-transparent border-none outline-none font-sans text-lg font-medium text-ink-900 placeholder:text-grey-300 placeholder:font-normal"
          />
        </div>

        {error && (
          <p className="mt-2 font-sans text-[13px] text-red-500">{error}</p>
        )}
      </div>

      {/* ToS + CTA */}
      <p className="font-sans text-[11px] text-ink-500 text-center leading-relaxed px-7 mb-5">
        By continuing, you agree to our{' '}
        <a href="#" className="text-purple-500 font-medium">Terms</a>
        {' '}and{' '}
        <a href="#" className="text-purple-500 font-medium">Privacy Policy</a>.
      </p>
      <div className="px-7 pb-11">
        <button
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          className="w-full py-[17px] rounded-2xl bg-purple-500 text-white font-display font-extrabold text-[17px] tracking-tight disabled:opacity-[0.35] disabled:cursor-default transition-opacity"
        >
          {isLoading ? 'Sending…' : 'Send code'}
        </button>
        <p className="mt-4 font-sans text-[10px] text-ink-500 text-center leading-relaxed">
          This site is protected by reCAPTCHA and the Google{' '}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Privacy Policy
          </a>
          {' '}and{' '}
          <a
            href="https://policies.google.com/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Terms of Service
          </a>
          {' '}apply.
        </p>
      </div>
    </main>
  )
}


export default function AuthPage() {
  return (
    <Suspense>
      <AuthContent />
    </Suspense>
  )
}
