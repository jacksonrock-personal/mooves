'use client'

// Screen 3c: Coarse area (Phase 12). Optional, skippable step between profile
// setup and the invite nudge. Same capture as Settings — device geolocation is
// coarsened to a zip server-side and discarded; only the zip is stored.
// Mockup: mooves-phase12-geo-substrate.html

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog'
import {
  captureDeviceArea,
  saveManualZip,
  GeolocationDeniedError,
  InvalidZipError,
  type CoarseArea,
} from '@/lib/geo/client'

type Step = 'ask' | 'manual' | 'locating' | 'set'

function AreaStep() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get('invite')

  const [step, setStep] = useState<Step>('ask')
  const [area, setArea] = useState<CoarseArea | null>(null)
  const [busy, setBusy] = useState(false)
  const [zip, setZip] = useState('')
  const [zipError, setZipError] = useState<string | null>(null)
  const [geoNote, setGeoNote] = useState<string | null>(null)

  function goNext() {
    router.push(inviteCode ? `/onboarding/interests?invite=${inviteCode}` : '/onboarding/interests')
  }

  function handleSkip() {
    posthog.capture('onboarding_area_skipped')
    goNext()
  }

  async function handleLocate() {
    setBusy(true)
    setGeoNote(null)
    setStep('locating')
    try {
      const result = await captureDeviceArea()
      setArea(result)
      setStep('set')
      posthog.capture('onboarding_area_set', { method: 'geo' })
    } catch (err) {
      setZip('')
      setZipError(null)
      setGeoNote(
        err instanceof GeolocationDeniedError
          ? 'Location access is off. Enter your zip instead.'
          : 'Couldn’t get your location. Enter your zip instead.',
      )
      setStep('manual')
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveZip() {
    const trimmed = zip.trim()
    if (!/^\d{5}$/.test(trimmed)) {
      setZipError('Enter a 5-digit US zip.')
      return
    }
    setBusy(true)
    setZipError(null)
    try {
      const result = await saveManualZip(trimmed)
      setArea(result)
      setStep('set')
      posthog.capture('onboarding_area_set', { method: 'manual' })
    } catch (err) {
      if (err instanceof InvalidZipError) setZipError("That doesn’t look like a US zip.")
      else setZipError('Something went wrong, try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-surface-bg flex flex-col">
      {/* Step dots — step 2 of 4 */}
      <div className="flex gap-1.5 justify-center pt-12">
        <div className="w-2 h-2 rounded-full bg-mooves-purple" />
        <div className="w-2 h-2 rounded-full bg-mooves-purple" />
        <div className="w-2 h-2 rounded-full bg-[#E8E4F5]" />
        <div className="w-2 h-2 rounded-full bg-[#E8E4F5]" />
      </div>

      {/* Ask */}
      {step === 'ask' && (
        <>
          <div className="flex-1 flex flex-col items-center justify-center px-7 text-center">
            <div className="w-20 h-20 rounded-full bg-purple-tint flex items-center justify-center mb-6">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" stroke="#7C5CDB" strokeWidth="2" strokeLinejoin="round" /><circle cx="12" cy="10" r="2.5" stroke="#7C5CDB" strokeWidth="2" /></svg>
            </div>
            <h1 className="font-display font-extrabold text-[26px] text-text-primary tracking-tight leading-[1.15] mb-2.5">
              Where are you<br />based?
            </h1>
            <p className="font-sans text-[14px] text-text-secondary leading-relaxed max-w-[260px]">
              We&apos;ll keep a coarse area, just your zip, to show you moves nearby later. Your
              exact location is never stored.
            </p>
          </div>
          <div className="px-7 pb-11 flex flex-col items-center gap-3.5">
            <button
              onClick={() => void handleLocate()}
              disabled={busy}
              className="w-full py-[17px] rounded-2xl bg-mooves-purple text-white font-display font-extrabold text-[17px] tracking-tight disabled:opacity-40"
            >
              Use my location
            </button>
            <button onClick={() => { setZip(''); setZipError(null); setGeoNote(null); setStep('manual') }} className="font-sans text-[14px] font-semibold text-mooves-purple">
              Enter zip instead
            </button>
            <button onClick={handleSkip} className="font-sans text-sm font-medium text-text-secondary">
              Skip for now
            </button>
          </div>
        </>
      )}

      {/* Manual */}
      {step === 'manual' && (
        <>
          <div className="flex-1 flex flex-col items-center justify-center px-7 text-center">
            <div className="w-20 h-20 rounded-full bg-purple-tint flex items-center justify-center mb-6">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none"><rect x="4" y="6" width="16" height="12" rx="2" stroke="#7C5CDB" strokeWidth="2" /><path d="M8 11h.01M12 11h.01M16 11h.01M8 14h5" stroke="#7C5CDB" strokeWidth="2" strokeLinecap="round" /></svg>
            </div>
            <h1 className="font-display font-extrabold text-[26px] text-text-primary tracking-tight leading-[1.15] mb-2.5">
              What&apos;s your<br />zip?
            </h1>
            <p className="font-sans text-[14px] text-text-secondary leading-relaxed max-w-[260px] mb-5">
              {geoNote ?? 'Just your zip, nothing more precise.'}
            </p>
            <input
              inputMode="numeric"
              maxLength={5}
              value={zip}
              onChange={e => { setZip(e.target.value.replace(/\D/g, '').slice(0, 5)); setZipError(null) }}
              placeholder="94110"
              className="w-full max-w-[260px] h-[54px] rounded-2xl border-[1.5px] border-mooves-purple text-center font-display font-extrabold text-[22px] tracking-[0.14em] text-text-primary outline-none placeholder:text-status-grey placeholder:font-bold placeholder:tracking-[0.08em]"
            />
            {zipError && <p className="font-sans text-[13px] text-[#E8405A] mt-2.5">{zipError}</p>}
          </div>
          <div className="px-7 pb-11 flex flex-col items-center gap-3.5">
            <button
              onClick={() => void handleSaveZip()}
              disabled={busy}
              className="w-full py-[17px] rounded-2xl bg-mooves-purple text-white font-display font-extrabold text-[17px] tracking-tight disabled:opacity-40"
            >
              {busy ? 'Saving…' : 'Continue'}
            </button>
            <button onClick={() => void handleLocate()} disabled={busy} className="font-sans text-[14px] font-semibold text-mooves-purple disabled:opacity-40">
              Use my location instead
            </button>
            <button onClick={handleSkip} className="font-sans text-sm font-medium text-text-secondary">
              Skip for now
            </button>
          </div>
        </>
      )}

      {/* Locating */}
      {step === 'locating' && (
        <div className="flex-1 flex flex-col items-center justify-center px-7 text-center">
          <div className="w-10 h-10 rounded-full border-[3px] border-purple-tint border-t-mooves-purple animate-spin mb-[18px]" />
          <h1 className="font-display font-extrabold text-[26px] text-text-primary tracking-tight leading-[1.15] mb-2.5">
            Finding your<br />area
          </h1>
          <p className="font-sans text-[14px] text-text-secondary leading-relaxed max-w-[260px]">
            Turning your location into a zip, then forgetting it.
          </p>
        </div>
      )}

      {/* Set */}
      {step === 'set' && area && (
        <>
          <div className="flex-1 flex flex-col items-center justify-center px-7 text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" stroke="#167A43" strokeWidth="2" strokeLinejoin="round" /><path d="M9.3 10.2l1.8 1.8 3.6-3.6" stroke="#167A43" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <h1 className="font-display font-extrabold text-[26px] text-text-primary tracking-tight leading-[1.15] mb-3">
              You&apos;re set.
            </h1>
            <div className="font-display font-extrabold text-[26px] text-text-primary">{area.zip}</div>
            {(area.city || area.state) && (
              <div className="font-sans text-[13px] text-text-secondary mt-1">
                {[area.city, area.state].filter(Boolean).join(', ')}
              </div>
            )}
            <p className="font-sans text-[14px] text-text-secondary leading-relaxed max-w-[260px] mt-3.5">
              You can change or remove this anytime in Settings.
            </p>
          </div>
          <div className="px-7 pb-11">
            <button
              onClick={goNext}
              className="w-full py-[17px] rounded-2xl bg-mooves-purple text-white font-display font-extrabold text-[17px] tracking-tight"
            >
              Continue
            </button>
          </div>
        </>
      )}
    </main>
  )
}

export default function OnboardingAreaPage() {
  return (
    <Suspense>
      <AreaStep />
    </Suspense>
  )
}
