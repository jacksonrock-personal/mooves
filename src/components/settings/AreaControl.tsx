'use client'

// Phase 12: the Settings "Your area" control. Opt-in coarse area (zip only).
// Device geolocation is coarsened to a zip server-side and discarded — the
// precise location is never stored. Mockup: mooves-phase12-geo-substrate.html.

import { useState } from 'react'
import { posthog } from '@/lib/posthog'
import {
  captureDeviceArea,
  saveManualZip,
  removeArea,
  GeolocationDeniedError,
  InvalidZipError,
  type CoarseArea,
} from '@/lib/geo/client'

interface AreaControlProps {
  initialZip: string | null
  initialCity: string | null
  initialState: string | null
}

type CardView = 'card' | 'locating' | 'manual'
type Sheet = 'none' | 'method' | 'edit'

export default function AreaControl({
  initialZip,
  initialCity,
  initialState,
}: AreaControlProps) {
  const [area, setArea] = useState<CoarseArea | null>(
    initialZip ? { zip: initialZip, city: initialCity ?? '', state: initialState ?? '' } : null,
  )
  const [view, setView] = useState<CardView>('card')
  const [sheet, setSheet] = useState<Sheet>('none')
  const [busy, setBusy] = useState(false)
  const [zip, setZip] = useState('')
  const [zipError, setZipError] = useState<string | null>(null)
  const [geoNote, setGeoNote] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const isSet = area !== null

  function openManual(note: string | null = null) {
    setZip('')
    setZipError(null)
    setGeoNote(note)
    setView('manual')
    setSheet('none')
  }

  async function handleLocate() {
    setSheet('none')
    setGeoNote(null)
    setBusy(true)
    setView('locating')
    try {
      const result = await captureDeviceArea()
      setArea(result)
      setView('card')
      posthog.capture('settings_area_set', { method: 'geo' })
    } catch (err) {
      // Denied or failed → fall back to manual zip entry with a gentle note.
      openManual(
        err instanceof GeolocationDeniedError
          ? 'Location access is off. Enter your zip instead.'
          : 'Couldn’t get your location. Enter your zip instead.',
      )
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
      setView('card')
      setGeoNote(null)
      posthog.capture('settings_area_set', { method: 'manual' })
    } catch (err) {
      if (err instanceof InvalidZipError) setZipError("That doesn't look like a US zip.")
      else setToast('Something went wrong, try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove() {
    setSheet('none')
    setBusy(true)
    const previous = area
    setArea(null)
    setView('card')
    try {
      await removeArea()
      posthog.capture('settings_area_removed')
    } catch {
      setArea(previous)
      setToast("Couldn't remove your area, try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="relative bg-white border border-[#E8E4F5] rounded-[20px] p-4 mx-4">
        {isSet && view === 'card' && (
          <button
            onClick={() => setSheet('edit')}
            aria-label="Edit area"
            className="absolute top-3.5 right-3.5 w-[34px] h-[34px] rounded-full bg-purple-50 flex items-center justify-center"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3Z" stroke="#5F3FC4" strokeWidth="2" strokeLinejoin="round" />
              <path d="M13.5 6.5l4 4" stroke="#5F3FC4" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}

        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isSet ? 'bg-green-100' : 'bg-purple-50'
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"
                stroke={isSet ? '#167A43' : '#7C5CDB'}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="10" r="2.5" stroke={isSet ? '#167A43' : '#7C5CDB'} strokeWidth="2" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="font-sans font-bold text-[15px] text-ink-900">Your area</div>
            <div
              className={`font-sans text-[13px] mt-0.5 ${
                isSet ? 'text-green-700 font-semibold' : 'text-ink-500'
              }`}
            >
              {isSet ? 'On' : view === 'manual' ? 'Enter your zip' : view === 'locating' ? 'Finding your area' : 'Not set'}
            </div>
          </div>
        </div>

        {/* No area */}
        {!isSet && view === 'card' && (
          <>
            <p className="font-sans text-[13px] leading-relaxed text-ink-500 mt-3 mb-4 px-0.5">
              Set a coarse area so you&apos;re ready for moves near you, coming soon. We only
              store your zip, never your exact location.
            </p>
            <button
              onClick={() => setSheet('method')}
              disabled={busy}
              className="w-full h-12 rounded-full bg-purple-500 text-white font-sans font-semibold text-[15px] disabled:opacity-40"
            >
              Set your area
            </button>
          </>
        )}

        {/* Locating */}
        {view === 'locating' && (
          <div className="flex flex-col items-center pt-4 pb-1.5">
            <div className="w-[34px] h-[34px] rounded-full border-[3px] border-purple-100 border-t-purple-500 animate-spin mb-3" />
            <div className="font-sans font-semibold text-[14px] text-ink-900">Finding your area</div>
            <div className="font-sans text-[12px] text-ink-500 mt-0.5 text-center">
              Turning your location into a zip, then forgetting it.
            </div>
          </div>
        )}

        {/* Area set */}
        {isSet && view === 'card' && (
          <>
            <div className="text-center pt-2 pb-0.5">
              <div className="font-display font-extrabold text-[34px] text-ink-900 tracking-tight">
                {area.zip}
              </div>
              {(area.city || area.state) && (
                <div className="font-sans text-[14px] text-ink-500 mt-0.5">
                  {[area.city, area.state].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
            <p className="font-sans text-[12px] leading-relaxed text-ink-500 text-center mt-3 px-1.5">
              Only your zip is stored. Your exact location was never saved.
            </p>
          </>
        )}

        {/* Manual zip */}
        {view === 'manual' && (
          <>
            <p className="font-sans text-[13px] leading-relaxed text-ink-500 mt-3 mb-3 px-0.5">
              {geoNote ?? 'Enter your zip code. That’s all we keep.'}
            </p>
            <label htmlFor="area-zip" className="block font-sans text-[12px] font-semibold text-ink-500 mb-1.5">
              ZIP code
            </label>
            <input
              id="area-zip"
              inputMode="numeric"
              maxLength={5}
              value={zip}
              onChange={e => {
                setZip(e.target.value.replace(/\D/g, '').slice(0, 5))
                setZipError(null)
              }}
              placeholder="94110"
              className="w-full h-[50px] rounded-[14px] border-[1.5px] border-purple-500 text-center font-display font-extrabold text-[22px] tracking-[0.14em] text-ink-900 outline-none placeholder:text-grey-300 placeholder:font-bold placeholder:tracking-[0.08em]"
            />
            {zipError ? (
              <div className="font-sans text-[12px] text-red-500 mt-2 text-center">{zipError}</div>
            ) : (
              <div className="font-sans text-[12px] text-ink-500 mt-2 text-center">US zip codes only, 5 digits.</div>
            )}
            <div className="flex gap-2.5 mt-3.5">
              <button
                onClick={() => {
                  setView('card')
                  setGeoNote(null)
                  setZipError(null)
                }}
                disabled={busy}
                className="flex-1 h-12 rounded-full bg-purple-100 text-purple-700 font-sans font-semibold text-[15px] disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSaveZip()}
                disabled={busy}
                className="flex-1 h-12 rounded-full bg-purple-500 text-white font-sans font-semibold text-[15px] disabled:opacity-40"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </>
        )}

        {toast && (
          <div className="font-sans text-[12px] text-red-500 mt-3 text-center">{toast}</div>
        )}
      </div>

      {/* Method sheet */}
      {sheet === 'method' && (
        <>
          <div className="fixed inset-0 bg-ink-900/50 z-40" onClick={() => setSheet('none')} aria-hidden="true" />
          <div className="fixed bottom-0 left-0 right-0 z-50 px-3 [--safe-pb-base:2rem] safe-area-pb">
            <div className="bg-white rounded-[28px] p-5 pb-6">
              <div className="w-[38px] h-1 rounded-full bg-[#DED8F0] mx-auto mb-4" />
              <div className="font-display font-extrabold text-[19px] text-ink-900 text-center">Set your area</div>
              <p className="font-sans text-[13px] text-ink-500 text-center mt-1.5 leading-snug px-2">
                We keep a coarse area (your zip) to get you ready for moves near you.
              </p>
              <div className="flex flex-col gap-2.5 mt-4">
                <button
                  onClick={() => void handleLocate()}
                  className="flex items-center gap-3 border border-[#E8E4F5] rounded-2xl p-3.5 text-left active:bg-purple-50"
                >
                  <span className="w-10 h-10 rounded-[11px] bg-purple-100 flex items-center justify-center shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" stroke="#7C5CDB" strokeWidth="2" strokeLinejoin="round" /><circle cx="12" cy="10" r="2.5" stroke="#7C5CDB" strokeWidth="2" /></svg>
                  </span>
                  <span className="flex flex-col">
                    <span className="font-sans font-bold text-[14px] text-ink-900">Use my location</span>
                    <span className="font-sans text-[12px] text-ink-500 mt-0.5 leading-snug">We turn it into a zip and forget the rest.</span>
                  </span>
                </button>
                <button
                  onClick={() => openManual(null)}
                  className="flex items-center gap-3 border border-[#E8E4F5] rounded-2xl p-3.5 text-left active:bg-purple-50"
                >
                  <span className="w-10 h-10 rounded-[11px] bg-purple-100 flex items-center justify-center shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="4" y="6" width="16" height="12" rx="2" stroke="#7C5CDB" strokeWidth="2" /><path d="M8 11h.01M12 11h.01M16 11h.01M8 14h5" stroke="#7C5CDB" strokeWidth="2" strokeLinecap="round" /></svg>
                  </span>
                  <span className="flex flex-col">
                    <span className="font-sans font-bold text-[14px] text-ink-900">Enter zip manually</span>
                    <span className="font-sans text-[12px] text-ink-500 mt-0.5 leading-snug">No location permission needed.</span>
                  </span>
                </button>
              </div>
              <p className="font-sans text-[12px] text-ink-500 text-center mt-4 leading-snug">
                Your exact location is never stored, only your zip.
              </p>
              <button
                onClick={() => setSheet('none')}
                className="w-full h-12 mt-3.5 rounded-full bg-purple-50 border border-[#E8E4F5] font-sans font-bold text-[15px] text-ink-900"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* Edit sheet */}
      {sheet === 'edit' && (
        <>
          <div className="fixed inset-0 bg-ink-900/50 z-40" onClick={() => setSheet('none')} aria-hidden="true" />
          <div className="fixed bottom-0 left-0 right-0 z-50 px-3 [--safe-pb-base:2rem] safe-area-pb">
            <div className="bg-white rounded-[28px] p-5 pb-6">
              <div className="w-[38px] h-1 rounded-full bg-[#DED8F0] mx-auto mb-4" />
              <div className="font-display font-extrabold text-[19px] text-ink-900 text-center">Your area</div>
              {area && (
                <p className="font-sans text-[13px] text-ink-500 text-center mt-1.5">
                  {area.zip}
                  {(area.city || area.state) ? ` · ${[area.city, area.state].filter(Boolean).join(', ')}` : ''}
                </p>
              )}
              <div className="rounded-[18px] overflow-hidden border border-[#E8E4F5] mt-4">
                <button
                  onClick={() => setSheet('method')}
                  className="w-full py-4 bg-white border-b border-[#E8E4F5] font-sans font-semibold text-[16px] text-purple-700"
                >
                  Change area
                </button>
                <button
                  onClick={() => void handleRemove()}
                  className="w-full py-4 bg-white font-sans font-semibold text-[16px] text-red-500"
                >
                  Remove area
                </button>
              </div>
              <button
                onClick={() => setSheet('none')}
                className="w-full h-12 mt-3.5 rounded-full bg-purple-50 border border-[#E8E4F5] font-sans font-bold text-[15px] text-ink-900"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
