'use client'

// Phase 13 surface 3 — sponsor phone-OTP auth (Mooves for Business).
// Reuses Firebase Phone Auth; on confirm, POSTs the ID token to
// /api/sponsor/auth/verify which issues the mooves-sponsor-token.

import { useEffect, useRef, useState } from 'react'
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth'
import { firebaseAuth } from '@/lib/firebase/client'

function formatPhone(digits: string): string {
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export default function SponsorAuth({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [businessName, setBusinessName] = useState('')
  const [rawDigits, setRawDigits] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recaptchaRef = useRef<HTMLDivElement | null>(null)
  const verifierRef = useRef<RecaptchaVerifier | null>(null)
  const confirmRef = useRef<ConfirmationResult | null>(null)

  function initRecaptcha() {
    if (!recaptchaRef.current) return
    verifierRef.current?.clear()
    recaptchaRef.current.innerHTML = ''
    verifierRef.current = new RecaptchaVerifier(firebaseAuth, recaptchaRef.current, { size: 'invisible' })
  }

  useEffect(() => {
    initRecaptcha()
    return () => {
      verifierRef.current?.clear()
      verifierRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function sendCode() {
    if (rawDigits.length !== 10 || loading) return
    if (mode === 'signup' && !businessName.trim()) {
      setError('Business name required.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (!verifierRef.current) initRecaptcha()
      const result = await signInWithPhoneNumber(firebaseAuth, `+1${rawDigits}`, verifierRef.current!)
      confirmRef.current = result
      setStep('code')
    } catch (err: unknown) {
      const c = (err as { code?: string }).code ?? ''
      console.error('[sponsor-auth] signInWithPhoneNumber failed:', c || '(no code)', err)
      setError(c === 'auth/too-many-requests' ? 'Too many attempts, try again in a few minutes.' : 'Something went wrong, please try again.')
      initRecaptcha()
    } finally {
      setLoading(false)
    }
  }

  async function verify() {
    if (code.length !== 6 || !confirmRef.current || loading) return
    setLoading(true)
    setError(null)
    try {
      const cred = await confirmRef.current.confirm(code)
      const idToken = await cred.user.getIdToken()
      const res = await fetch('/api/sponsor/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, businessName: businessName.trim() || undefined }),
      })
      if (!res.ok) throw new Error('verify failed')
      onAuthed()
    } catch {
      setError("That code didn't work, try again.")
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full border-[1.5px] border-[#E8E4F5] rounded-[10px] px-3 py-2.5 text-[14px] text-ink-900 outline-none focus:border-purple-500'

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(160deg, #7C5CDB, #9B7FE8 55%, #A98FF0)' }}>
      <div ref={recaptchaRef} />
      <div className="w-[380px] max-w-full bg-white rounded-[22px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
        <div className="text-center font-display font-extrabold text-[20px] text-ink-900">M<span className="text-purple-500">oo</span>ves</div>
        <div className="text-center text-[11px] font-bold uppercase tracking-[0.1em] text-grey-300 mb-6">for Business</div>

        {step === 'phone' ? (
          <>
            <h2 className="font-display font-extrabold text-[21px] text-ink-900 text-center mb-1">
              {mode === 'signin' ? 'Welcome back' : 'Create a sponsor account'}
            </h2>
            <p className="text-[13px] text-ink-500 text-center mb-5">
              {mode === 'signin' ? "Sign in with your phone. We'll text you a code." : 'Put your place in front of people nearby.'}
            </p>
            {mode === 'signup' && (
              <div className="mb-3.5">
                <label className="block text-[12px] font-bold text-ink-500 mb-1.5">Business name</label>
                <input value={businessName} onChange={e => setBusinessName(e.target.value.slice(0, 80))} placeholder="The Vista" className={inputCls} />
              </div>
            )}
            <div className="mb-3.5">
              <label className="block text-[12px] font-bold text-ink-500 mb-1.5">Phone number</label>
              <div className="flex items-center gap-2">
                <span className="text-[14px] text-ink-500">🇺🇸 +1</span>
                <input
                  type="tel"
                  inputMode="tel"
                  value={formatPhone(rawDigits)}
                  onChange={e => { setRawDigits(e.target.value.replace(/\D/g, '').slice(0, 10)); if (error) setError(null) }}
                  onKeyDown={e => { if (e.key === 'Enter') void sendCode() }}
                  placeholder="(312) 555 0148"
                  className={inputCls}
                />
              </div>
            </div>
            {error && <p className="text-[13px] text-red-500 mb-2">{error}</p>}
            <button onClick={() => void sendCode()} disabled={rawDigits.length !== 10 || loading}
              className="w-full bg-purple-500 text-white rounded-xl py-3 font-bold text-[15px] mt-1 disabled:opacity-40">
              {loading ? 'Sending…' : 'Send code'}
            </button>
            <div className="text-center text-[13px] text-ink-500 mt-4">
              {mode === 'signin' ? (
                <>New to Mooves? <button onClick={() => setMode('signup')} className="text-purple-700 font-semibold">Create a sponsor account</button></>
              ) : (
                <>Already have one? <button onClick={() => setMode('signin')} className="text-purple-700 font-semibold">Sign in</button></>
              )}
            </div>
            <p className="text-center text-[11px] text-grey-300 mt-4 leading-relaxed">
              No passwords, we text you a code each time. Moves are reviewed by Mooves before they go live. This site is protected by reCAPTCHA.
            </p>
          </>
        ) : (
          <>
            <h2 className="font-display font-extrabold text-[21px] text-ink-900 text-center mb-1">Enter your code</h2>
            <p className="text-[13px] text-ink-500 text-center mb-5">We texted a 6-digit code to your phone.</p>
            <input
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); if (error) setError(null) }}
              onKeyDown={e => { if (e.key === 'Enter') void verify() }}
              autoFocus
              placeholder="••••••"
              className="w-full border-[1.5px] border-[#E8E4F5] rounded-[12px] px-3 py-3.5 text-center font-display font-extrabold text-[26px] tracking-[0.4em] text-ink-900 outline-none focus:border-purple-500 placeholder:text-grey-300"
            />
            {error && <p className="text-[13px] text-red-500 mt-2">{error}</p>}
            <button onClick={() => void verify()} disabled={code.length !== 6 || loading}
              className="w-full bg-purple-500 text-white rounded-xl py-3 font-bold text-[15px] mt-4 disabled:opacity-40">
              {loading ? 'Verifying…' : 'Verify'}
            </button>
            <div className="text-center text-[13px] text-ink-500 mt-4">
              <button onClick={() => { setStep('phone'); setCode(''); setError(null); initRecaptcha() }} className="text-purple-700 font-semibold">Use a different number</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
