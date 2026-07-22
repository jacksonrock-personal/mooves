'use client'

// Screen: Discover — "moves in my area" (Phase 13.1–13.3 + 13.8 entry).
// Sponsored moves filtered by coarse area (Phase 12) + opted-in interests.
// Never friend/stranger greens. Mockup: mooves-phase13-discover.html.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { initPostHog, posthog } from '@/lib/posthog'
import BottomNav from '@/components/ui/BottomNav'
import Wordmark from '@/components/ui/Wordmark'
import CowIllustration from '@/components/ui/CowIllustration'
import Toast from '@/components/ui/Toast'
import InterestPicker from './InterestPicker'
import SponsoredCard, { type SponsoredMove } from './SponsoredCard'
import { groupMoves, isHappeningNow } from '@/lib/discoverGroups'
import {
  captureDeviceArea,
  saveManualZip,
  GeolocationDeniedError,
  InvalidZipError,
  type CoarseArea,
} from '@/lib/geo/client'

export default function DiscoverScreen() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(true)
  const [moves, setMoves] = useState<SponsoredMove[]>([])
  const [area, setArea] = useState<CoarseArea | null>(null)
  const [interests, setInterests] = useState<string[]>([])

  // Setup form
  const [formInterests, setFormInterests] = useState<string[]>([])
  const [leftSetup, setLeftSetup] = useState(false)
  const [forceSetup, setForceSetup] = useState(false)
  const [choosingArea, setChoosingArea] = useState(false)
  const [areaMode, setAreaMode] = useState<'idle' | 'locating' | 'manual'>('idle')
  const [zip, setZip] = useState('')
  const [zipError, setZipError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const mountedRef = useRef(true)

  async function loadDiscover() {
    const [meRes, discRes] = await Promise.all([
      fetch('/api/users/me').then(r => r.json()) as Promise<{
        areaZip: string | null
        areaCity: string | null
        areaState: string | null
        interests: string[]
      }>,
      fetch('/api/discover').then(r => r.json()) as Promise<{
        needsSetup: boolean
        moves: SponsoredMove[]
      }>,
    ])
    if (!mountedRef.current) return
    const a = meRes.areaZip ? { zip: meRes.areaZip, city: meRes.areaCity ?? '', state: meRes.areaState ?? '' } : null
    setArea(a)
    setInterests(meRes.interests ?? [])
    setFormInterests(meRes.interests ?? [])
    setChoosingArea(!a)
    setNeedsSetup(discRes.needsSetup)
    setMoves(discRes.moves ?? [])
    setLoading(false)
  }

  useEffect(() => {
    mountedRef.current = true
    initPostHog()
    posthog.capture('discover_viewed')
    void loadDiscover()
    return () => {
      mountedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLocate() {
    setAreaMode('locating')
    setZipError(null)
    try {
      const result = await captureDeviceArea()
      setArea(result)
      setChoosingArea(false)
      setAreaMode('idle')
    } catch (err) {
      setAreaMode('manual')
      setZip('')
      setZipError(
        err instanceof GeolocationDeniedError
          ? 'Location access is off. Enter your zip instead.'
          : 'Couldn’t get your location. Enter your zip instead.',
      )
    }
  }

  async function handleSaveZip() {
    const trimmed = zip.trim()
    if (!/^\d{5}$/.test(trimmed)) {
      setZipError('Enter a 5-digit US zip.')
      return
    }
    try {
      const result = await saveManualZip(trimmed)
      setArea(result)
      setChoosingArea(false)
      setAreaMode('idle')
      setZipError(null)
    } catch (err) {
      setZipError(err instanceof InvalidZipError ? "That doesn’t look like a US zip." : 'Something went wrong.')
    }
  }

  async function saveInterests() {
    await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interests: formInterests }),
    })
  }

  async function handleSeeMoves() {
    if (saving) return
    setSaving(true)
    posthog.capture('discover_setup_completed', { interests: formInterests.length, hasArea: !!area })
    try {
      await saveInterests()
      setLeftSetup(true)
      setForceSetup(false)
      await loadDiscover()
    } catch {
      setToast('Something went wrong, try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleSkip() {
    posthog.capture('discover_setup_skipped')
    void saveInterests()
    setLeftSetup(true)
    setForceSetup(false)
  }

  function handleInterestedChange(id: string, interested: boolean) {
    setMoves(prev => prev.map(m => (m.id === id ? { ...m, interestedByMe: interested } : m)))
  }

  function handleGoWithFriends(id: string) {
    posthog.capture('sponsored_go_with_friends', { move: id })
    router.push(`/feed?anchor=${id}`)
  }

  const showForm = !loading && (forceSetup || (needsSetup && !leftSetup))
  const showGentle = !loading && needsSetup && leftSetup && !forceSetup
  const showFeed = !loading && !needsSetup && moves.length > 0
  const showEmpty = !loading && !needsSetup && moves.length === 0

  return (
    <div className="min-h-screen flex flex-col bg-purple-50">
      <header className="bg-white px-5 pt-10 pb-3 border-b border-[#E8E4F5] shrink-0">
        <div className="flex justify-center mb-2.5">
          <Wordmark withCow />
        </div>
        <div className="flex items-center justify-between">
          <h1 className="font-display font-extrabold text-[24px] text-ink-900 tracking-tight">Discover</h1>
          {area && (
            <button
              onClick={() => setForceSetup(true)}
              className="inline-flex items-center gap-1.5 bg-purple-50 border border-[#E8E4F5] rounded-full px-3 py-1.5 text-[12px] font-semibold text-purple-700"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" stroke="#5F3FC4" strokeWidth="2" strokeLinejoin="round" />
                <circle cx="12" cy="10" r="2.5" stroke="#5F3FC4" strokeWidth="2" />
              </svg>
              Near {area.zip}
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
        {loading && (
          <div className="flex justify-center pt-16">
            <div className="w-8 h-8 rounded-full border-[3px] border-purple-100 border-t-purple-500 animate-spin" />
          </div>
        )}

        {/* SETUP FORM (13.1) */}
        {showForm && (
          <>
            <h2 className="font-display font-extrabold text-[22px] text-ink-900 tracking-tight mt-1 mb-1.5">
              See moves near you
            </h2>
            <p className="font-sans text-[13.5px] leading-relaxed text-ink-500 mb-5">
              Set your area and pick a few interests. We&apos;ll show you local moves worth leaving the
              house for. You can change these anytime.
            </p>

            <div className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-ink-500 mb-2">
              Your area
            </div>
            {area && !choosingArea ? (
              <div className="flex items-center gap-3 bg-white border border-[#E8E4F5] rounded-2xl p-3.5 mb-6">
                <span className="w-9 h-9 rounded-[10px] bg-green-100 flex items-center justify-center shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" stroke="#167A43" strokeWidth="2" strokeLinejoin="round" /><circle cx="12" cy="10" r="2.5" stroke="#167A43" strokeWidth="2" /></svg>
                </span>
                <div className="flex-1">
                  <div className="font-sans font-bold text-[14px] text-ink-900">{area.zip}</div>
                  {(area.city || area.state) && (
                    <div className="font-sans text-[12px] text-green-700 font-semibold">
                      {[area.city, area.state].filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>
                <button onClick={() => { setChoosingArea(true); setAreaMode('idle') }} className="text-[13px] font-semibold text-purple-700">
                  Change
                </button>
              </div>
            ) : areaMode === 'locating' ? (
              <div className="flex items-center gap-3 bg-white border border-[#E8E4F5] rounded-2xl p-4 mb-6">
                <div className="w-6 h-6 rounded-full border-[3px] border-purple-100 border-t-purple-500 animate-spin" />
                <span className="font-sans text-[13px] text-ink-500">Turning your location into a zip, then forgetting it.</span>
              </div>
            ) : areaMode === 'manual' ? (
              <div className="mb-6">
                <input
                  inputMode="numeric"
                  maxLength={5}
                  value={zip}
                  onChange={e => { setZip(e.target.value.replace(/\D/g, '').slice(0, 5)); setZipError(null) }}
                  placeholder="94110"
                  className="w-full h-[50px] rounded-[14px] border-[1.5px] border-purple-500 text-center font-display font-extrabold text-[22px] tracking-[0.14em] text-ink-900 outline-none placeholder:text-grey-300 placeholder:font-bold"
                />
                {zipError && <div className="text-[12px] text-red-500 mt-2 text-center">{zipError}</div>}
                <div className="flex gap-2.5 mt-3">
                  <button onClick={() => setAreaMode('idle')} className="flex-1 h-11 rounded-full bg-purple-100 text-purple-700 font-sans font-semibold text-[14px]">Back</button>
                  <button onClick={() => void handleSaveZip()} className="flex-1 h-11 rounded-full bg-purple-500 text-white font-sans font-semibold text-[14px]">Save zip</button>
                </div>
              </div>
            ) : (
              <div className="mb-6">
                <button onClick={() => void handleLocate()} className="w-full h-12 rounded-full bg-purple-500 text-white font-sans font-semibold text-[15px] mb-2.5">
                  Use my location
                </button>
                <button onClick={() => { setAreaMode('manual'); setZip(''); setZipError(null) }} className="w-full text-center text-[14px] font-semibold text-purple-700">
                  Enter zip instead
                </button>
              </div>
            )}

            <div className="font-sans text-[11px] font-bold uppercase tracking-[0.05em] text-ink-500 mb-2.5">
              Your interests
            </div>
            <div className="mb-6">
              <InterestPicker selected={formInterests} onChange={setFormInterests} />
            </div>

            <button
              onClick={() => void handleSeeMoves()}
              disabled={saving}
              className="w-full h-12 rounded-full bg-purple-500 text-white font-sans font-semibold text-[15px] disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'See moves near you'}
            </button>
            <button onClick={handleSkip} className="w-full text-center mt-3 text-[14px] font-medium text-ink-500">
              Skip for now
            </button>
          </>
        )}

        {/* FEED (13.2 / 13.3 / 13.2a day groups) */}
        {showFeed && (
          <>
            <p className="font-sans text-[12px] text-ink-500 mb-3.5 px-0.5">
              {moves.length} {moves.length === 1 ? 'move matches' : 'moves match'} your area and interests.
            </p>
            {groupMoves(moves).map((group, gi) => (
              <div key={group.label ?? 'all'}>
                {group.label && (
                  <div
                    className={`font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-ink-500 mb-2.5 px-0.5 ${gi > 0 ? 'mt-5' : ''}`}
                  >
                    {group.label}
                  </div>
                )}
                {group.moves.map(m => (
                  <SponsoredCard
                    key={m.id}
                    move={m}
                    happeningNow={isHappeningNow(m.startAt)}
                    onInterestedChange={handleInterestedChange}
                    onGoWithFriends={handleGoWithFriends}
                  />
                ))}
              </div>
            ))}
          </>
        )}

        {/* EMPTY — no matches */}
        {showEmpty && (
          <div className="flex flex-col items-center text-center pt-10 px-5">
            <CowIllustration size={88} className="mb-4 opacity-90" />
            <h3 className="font-display font-extrabold text-[19px] text-ink-900 mb-2">No moves near you yet</h3>
            <p className="font-sans text-[13.5px] leading-relaxed text-ink-500 max-w-[240px] mb-5">
              Nothing local matches your interests right now. Check back soon, new moves land here often.
            </p>
            <button onClick={() => setForceSetup(true)} className="px-6 h-11 rounded-full bg-purple-100 text-purple-700 font-sans font-semibold text-[14px]">
              Edit interests
            </button>
          </div>
        )}

        {/* NEEDS SETUP — gentle prompt after skipping */}
        {showGentle && (
          <div className="flex flex-col items-center text-center pt-10 px-5">
            <CowIllustration size={88} className="mb-4 opacity-90" />
            <h3 className="font-display font-extrabold text-[19px] text-ink-900 mb-2">Set your area and interests</h3>
            <p className="font-sans text-[13.5px] leading-relaxed text-ink-500 max-w-[240px] mb-5">
              Tell us where you are and what you&apos;re into, and we&apos;ll show you moves near you.
            </p>
            <button onClick={() => setForceSetup(true)} className="px-6 h-11 rounded-full bg-purple-500 text-white font-sans font-semibold text-[14px]">
              Set them up
            </button>
          </div>
        )}
      </div>

      <BottomNav />
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  )
}
