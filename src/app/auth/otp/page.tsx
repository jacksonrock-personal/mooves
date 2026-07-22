'use client'

// Screen 2b: OTP Code Entry
// Mockup: mooves-screen2-auth.html

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth'
import { firebaseAuth } from '@/lib/firebase/client'
import {
  clearConfirmationResult,
  retrieveConfirmationResult,
  storeConfirmationResult,
} from '@/lib/auth/otp-state'
import { posthog } from '@/lib/posthog'

function formatDisplay(e164: string): string {
  const digits = e164.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    const d = digits.slice(1)
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  }
  return e164
}

function OtpContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get('invite')

  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [focusedIdx, setFocusedIdx] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [countdown, setCountdown] = useState(30)
  const [phone, setPhone] = useState<string | null>(null)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('mooves_otp_phone')
    if (!stored || !retrieveConfirmationResult()) {
      router.replace(inviteCode ? `/auth?invite=${inviteCode}` : '/auth')
      return
    }
    setPhone(stored)
    setTimeout(() => inputRefs.current[0]?.focus(), 100)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (countdown <= 0) return
    const id = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(id)
  }, [countdown])

  async function doResend() {
    const storedPhone = sessionStorage.getItem('mooves_otp_phone')
    if (!storedPhone || !recaptchaContainerRef.current) return
    try {
      const verifier = new RecaptchaVerifier(
        firebaseAuth,
        recaptchaContainerRef.current,
        { size: 'invisible' },
      )
      const result = await signInWithPhoneNumber(firebaseAuth, storedPhone, verifier)
      storeConfirmationResult(result)
      setCountdown(30)
      setDigits(['', '', '', '', '', ''])
      setError(null)
      posthog.capture('auth_otp_resend')
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    } catch {
      setError("Couldn't resend code, try again.")
    }
  }

  async function doVerify(code: string) {
    const result = retrieveConfirmationResult()
    if (!result) return

    setIsVerifying(true)
    setError(null)
    posthog.capture('auth_otp_submitted')

    try {
      const cred = await result.confirm(code)
      const idToken = await cred.user.getIdToken()
      clearConfirmationResult()
      sessionStorage.removeItem('mooves_otp_phone')

      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })
      if (!res.ok) throw new Error('verify_failed')

      const data = await res.json() as {
        isNewUser: boolean
        onboardingComplete: boolean
      }

      if (data.isNewUser || !data.onboardingComplete) {
        posthog.capture('auth_success_new_user')
        router.replace(inviteCode ? `/onboarding?invite=${inviteCode}` : '/onboarding')
      } else {
        posthog.capture('auth_success_returning')
        router.replace(inviteCode ? `/feed?invite=${inviteCode}` : '/feed')
      }
    } catch (err: unknown) {
      setIsVerifying(false)
      setDigits(['', '', '', '', '', ''])

      const errCode = (err as { code?: string }).code ?? ''
      if (err instanceof Error && err.message === 'verify_failed') {
        // The Firebase code was right, our server-side verify failed. Don't
        // blame the code, the user would retry a now-consumed OTP forever.
        setError("Your code was right, but signing in failed. Try again in a moment.")
        posthog.capture('auth_verify_failed')
      } else if (errCode === 'auth/code-expired') {
        setError("That code expired, we've sent a new one.")
        setCountdown(0)
        void doResend()
      } else if (errCode === 'auth/too-many-requests') {
        setError('Too many attempts, try again in a few minutes.')
      } else {
        setError("That code isn't right, try again.")
        posthog.capture('auth_otp_error')
      }
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>, idx: number) {
    const raw = e.target.value.replace(/\D/g, '')

    // Handle full-code paste (iOS SMS autofill delivers all 6 digits)
    if (raw.length === 6) {
      const next = raw.split('')
      setDigits(next)
      setFocusedIdx(5)
      inputRefs.current[5]?.focus()
      void doVerify(raw)
      return
    }

    const single = raw.slice(-1)
    const next = [...digits]
    next[idx] = single
    setDigits(next)
    setError(null)

    if (single && idx < 5) {
      setFocusedIdx(idx + 1)
      inputRefs.current[idx + 1]?.focus()
    }

    if (next.every(d => d !== '') && single) {
      void doVerify(next.join(''))
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, idx: number) {
    if (e.key === 'Backspace' && digits[idx] === '' && idx > 0) {
      const next = [...digits]
      next[idx - 1] = ''
      setDigits(next)
      setFocusedIdx(idx - 1)
      inputRefs.current[idx - 1]?.focus()
    }
  }

  const hasError = error !== null

  return (
    <main className="min-h-screen bg-surface-bg flex flex-col">
      <div ref={recaptchaContainerRef} />

      {/* Nav */}
      <div className="flex items-center px-6 pt-12">
        <button
          onClick={() => router.push(inviteCode ? `/auth?invite=${inviteCode}` : '/auth')}
          className="flex items-center gap-1.5 text-mooves-purple font-sans text-sm font-semibold"
        >
          <span className="text-xl leading-none">‹</span>
          <span>Wrong number?</span>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col px-7 pt-10">
        <h1 className="font-display font-extrabold text-[28px] text-text-primary tracking-tight leading-[1.15] mb-2.5">
          Check your<br />texts
        </h1>
        <p className="font-sans text-[15px] text-text-secondary leading-relaxed mb-9">
          We sent a 6-digit code to {phone ? formatDisplay(phone) : 'your number'}.
        </p>

        {/* OTP boxes */}
        <div className="flex gap-2 justify-center mb-7">
          {digits.map((d, i) => {
            const isActive = focusedIdx === i && !hasError && !isVerifying
            const isFilled = d !== '' && !hasError
            const isErrFilled = d !== '' && hasError
            return (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el }}
                type="tel"
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                maxLength={6}
                value={d}
                onChange={e => handleChange(e, i)}
                onKeyDown={e => handleKeyDown(e, i)}
                onFocus={() => setFocusedIdx(i)}
                disabled={isVerifying}
                className={[
                  'w-[44px] h-[52px] rounded-xl border-2 text-center font-sans text-[22px] font-bold outline-none transition-all caret-transparent',
                  isErrFilled
                    ? 'bg-[#FEE8EC] border-[#E8405A] text-[#E8405A]'
                    : isFilled
                      ? 'bg-purple-tint border-mooves-purple text-mooves-purple'
                      : isActive
                        ? 'bg-card-white border-mooves-purple shadow-[0_0_0_4px_rgba(124,92,219,0.1)] text-text-primary'
                        : 'bg-card-white border-[#E8E4F5] text-text-primary',
                ].join(' ')}
              />
            )
          })}
        </div>

        {error && (
          <p className="font-sans text-[13px] text-[#E8405A] text-center mb-5">
            {error}
          </p>
        )}

        {/* Resend */}
        <div className="flex items-center justify-center gap-1.5">
          <span className="font-sans text-sm text-text-secondary">Didn't get it?</span>
          <button
            onClick={countdown === 0 ? () => void doResend() : undefined}
            className={`font-sans text-sm font-semibold ${
              countdown > 0 ? 'text-status-grey cursor-default' : 'text-mooves-purple'
            }`}
          >
            {countdown > 0
              ? `Resend in 0:${String(countdown).padStart(2, '0')}`
              : 'Resend code'}
          </button>
        </div>
      </div>
    </main>
  )
}

export default function OtpPage() {
  return (
    <Suspense>
      <OtpContent />
    </Suspense>
  )
}
