'use client'

// Phase 24.8 — browse. Everything near you, all seven days, grouped by day.
//
// Reached two ways, and R25 is the second one coming back. "See all" on the
// feed's near-you shelf still pushes this screen and is still the main road to
// it — 24.6's lesson holds, that a tab nobody remembers to visit is not a
// distribution strategy, so the moves themselves stay in the feed and this is
// the thing a feed genuinely cannot do: search and filter. The Discover tab is
// now a second door onto the same screen for people who go looking for one.
//
// NO BACK ARROW. This screen carries a bottom nav now, and a tab with a back
// chevron is a tab pretending to be a pushed screen — no other tab in the app
// has one. Arrivals from "See all" leave the same way everyone else does, by
// pressing Feed. "See all" itself is untouched: it still pushes this route, so
// the system back gesture still works for the people who came that way.
//
// THREE THINGS THAT USED TO BE HERE AND ARE NOT:
//
//   · The setup form. Area and interests were a wall in front of an empty list.
//     Area is now a chip you can set if you want to, and the list is already
//     there behind it.
//   · The interest filter. Interests shape ranking, not membership (24.7).
//   · "I'm interested". Replaced by "I'd go", which lives in the detail sheet
//     because the card carries one CTA and one CTA only.
//
// Community and Sponsored are INTERLEAVED and sorted purely by day. Never
// segregated, never ranked by who paid. A sponsor cannot buy position here —
// a current-state decision, revisitable, and the schema does not foreclose it.
//
// Filtering is client-side on purpose: the whole week's list is small (the
// seeding job caps at 5–10 per metro per day), and a filter that costs a
// round-trip stops feeling like a filter.
//
// Mockup: mooves-concept-mooves-in-feed.html, toggle 5.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { initPostHog, posthog } from '@/lib/posthog'
import BottomNav from '@/components/ui/BottomNav'
import CowIllustration from '@/components/ui/CowIllustration'
import Toast from '@/components/ui/Toast'
import MooveCard from '@/components/feed/MooveCard'
import MooveDetailSheet from './MooveDetailSheet'
import { groupMoves, matchesWhen } from '@/lib/discoverGroups'
import type { NearMove } from '@/app/api/discover/route'
import {
  captureDeviceArea,
  saveManualZip,
  GeolocationDeniedError,
  InvalidZipError,
  type CoarseArea,
} from '@/lib/geo/client'

type When = 'all' | 'tonight' | 'tomorrow' | 'weekend'

const WHEN_LABEL: Record<When, string> = {
  all: 'All week',
  tonight: 'Tonight',
  tomorrow: 'Tomorrow',
  weekend: 'Weekend',
}

export default function DiscoverScreen() {
  const router = useRouter()
  const mountedRef = useRef(true)

  const [loading, setLoading] = useState(true)
  const [moves, setMoves] = useState<NearMove[]>([])
  const [area, setArea] = useState<CoarseArea | null>(null)
  const [detail, setDetail] = useState<NearMove | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Filters
  const [when, setWhen] = useState<When>('all')
  const [freeOnly, setFreeOnly] = useState(false)
  const [friendsOnly, setFriendsOnly] = useState(false)
  const [q, setQ] = useState('')

  // Area editing
  const [editingArea, setEditingArea] = useState(false)
  const [areaMode, setAreaMode] = useState<'idle' | 'locating' | 'manual'>('idle')
  const [zip, setZip] = useState('')
  const [zipError, setZipError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [meRes, listRes] = await Promise.all([
      fetch('/api/users/me').then(r => r.json()) as Promise<{
        areaZip: string | null
        areaCity: string | null
        areaState: string | null
      }>,
      fetch('/api/discover?limit=50').then(r => r.json()) as Promise<{ moves?: NearMove[] }>,
    ])
    if (!mountedRef.current) return
    setArea(
      meRes.areaZip
        ? { zip: meRes.areaZip, city: meRes.areaCity ?? '', state: meRes.areaState ?? '' }
        : null,
    )
    setMoves(listRes.moves ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    initPostHog()
    posthog.capture('browse_viewed')
    void load()
    return () => {
      mountedRef.current = false
    }
  }, [load])

  const now = useMemo(() => new Date(), [])

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return moves.filter(m => {
      if (freeOnly && m.isFree !== true) return false
      if (friendsOnly && !m.social) return false
      if (!matchesWhen(m.startAt, when, now)) return false
      if (needle) {
        const hay = `${m.title} ${m.neighborhood ?? ''} ${m.description ?? ''} ${m.brand ?? ''}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [moves, freeOnly, friendsOnly, when, q, now])

  const groups = useMemo(() => groupMoves(hits, now), [hits, now])
  const filtered = when !== 'all' || freeOnly || friendsOnly || q.trim().length > 0

  function clearFilters() {
    setWhen('all')
    setFreeOnly(false)
    setFriendsOnly(false)
    setQ('')
  }

  function handleInterestedChange(id: string, interested: boolean) {
    setMoves(prev => prev.map(m => (m.id === id ? { ...m, interestedByMe: interested } : m)))
    setDetail(prev => (prev && prev.id === id ? { ...prev, interestedByMe: interested } : prev))
  }

  // Browse hands off to the feed, which owns the composer. ?anchor= is exactly
  // the path 13.8 built for arrivals from outside the feed.
  function handleMakeMoove(move: NearMove) {
    posthog.capture('near_make_moove', { move: move.id, origin: move.origin, from: 'browse' })
    router.push(`/feed?anchor=${move.id}`)
  }

  async function handleLocate() {
    setAreaMode('locating')
    setZipError(null)
    try {
      const result = await captureDeviceArea()
      if (!mountedRef.current) return
      setArea(result)
      setEditingArea(false)
      setAreaMode('idle')
      void load()
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
      if (!mountedRef.current) return
      setArea(result)
      setEditingArea(false)
      setAreaMode('idle')
      setZipError(null)
      void load()
    } catch (err) {
      setZipError(
        err instanceof InvalidZipError ? 'That doesn’t look like a US zip.' : 'Something went wrong.',
      )
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-purple-50">
      <header className="bg-white [--safe-pt-base:0.875rem] safe-area-pt px-4 pb-3 border-b border-[#E8E4F5] shrink-0">
        <div className="flex items-center gap-2.5 mb-3">
          <h1 className="flex-1 font-display font-extrabold text-[19px] text-ink-900 tracking-tight">
            Near you
          </h1>
          <button
            onClick={() => {
              setEditingArea(v => !v)
              setAreaMode('idle')
            }}
            className="shrink-0 inline-flex items-center gap-1.5 bg-purple-50 border border-[#E8E4F5] rounded-full px-2.5 py-1.5 font-sans text-[11.5px] font-semibold text-purple-700"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" stroke="#5F3FC4" strokeWidth="2" strokeLinejoin="round" />
              <circle cx="12" cy="10" r="2.5" stroke="#5F3FC4" strokeWidth="2" />
            </svg>
            {area?.zip ?? 'Set area'}
          </button>
        </div>

        {/* Area is a chip, not a gate. The list is already behind it. */}
        {editingArea && (
          <div className="mb-3">
            {areaMode === 'locating' ? (
              <div className="flex items-center gap-3 bg-purple-50 border border-[#E8E4F5] rounded-2xl p-3.5">
                <div className="w-5 h-5 rounded-full border-[3px] border-purple-100 border-t-purple-500 animate-spin" />
                <span className="font-sans text-[12.5px] text-ink-500">
                  Turning your location into a zip, then forgetting it.
                </span>
              </div>
            ) : areaMode === 'manual' ? (
              <>
                <input
                  inputMode="numeric"
                  maxLength={5}
                  value={zip}
                  onChange={e => {
                    setZip(e.target.value.replace(/\D/g, '').slice(0, 5))
                    setZipError(null)
                  }}
                  placeholder="94110"
                  className="w-full h-[46px] rounded-[14px] border-[1.5px] border-purple-500 text-center font-display font-extrabold text-[20px] tracking-[0.14em] text-ink-900 outline-none placeholder:text-grey-300"
                />
                {zipError && <p className="font-sans text-[12px] text-red-500 mt-1.5 text-center">{zipError}</p>}
                <div className="flex gap-2.5 mt-2.5">
                  <button onClick={() => setAreaMode('idle')} className="flex-1 h-10 rounded-full bg-purple-100 text-purple-700 font-sans font-semibold text-[13.5px]">
                    Back
                  </button>
                  <button onClick={() => void handleSaveZip()} className="flex-1 h-10 rounded-full bg-purple-500 text-white font-sans font-semibold text-[13.5px]">
                    Save zip
                  </button>
                </div>
              </>
            ) : (
              <div className="flex gap-2.5">
                <button onClick={() => void handleLocate()} className="flex-1 h-10 rounded-full bg-purple-500 text-white font-sans font-semibold text-[13.5px]">
                  Use my location
                </button>
                <button
                  onClick={() => {
                    setAreaMode('manual')
                    setZip('')
                    setZipError(null)
                  }}
                  className="flex-1 h-10 rounded-full bg-purple-100 text-purple-700 font-sans font-semibold text-[13.5px]"
                >
                  Enter zip
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 bg-purple-50 border-[1.5px] border-[#E8E4F5] rounded-[13px] px-3 h-10 mb-2.5">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#BDB5D4" strokeWidth="2.3" strokeLinecap="round" className="shrink-0">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search moves, places"
            aria-label="Search moves and places"
            className="flex-1 min-w-0 bg-transparent border-0 outline-none font-sans text-[13.5px] text-ink-900 placeholder:text-grey-300"
          />
        </div>

        {/* Time first, because time is the strongest signal in the system. */}
        <div className="flex bg-grey-100 rounded-[11px] p-[3px] mb-2.5">
          {(Object.keys(WHEN_LABEL) as When[]).map(w => (
            <button
              key={w}
              onClick={() => setWhen(w)}
              className={`flex-1 py-[7px] px-0.5 rounded-[9px] font-sans text-[12px] whitespace-nowrap ${
                when === w ? 'bg-white text-ink-900 font-bold shadow-[0_1px_3px_rgba(28,23,48,0.1)]' : 'text-ink-500 font-semibold'
              }`}
            >
              {WHEN_LABEL[w]}
            </button>
          ))}
        </div>

        <div className="flex gap-[7px]">
          {([
            ['Free', freeOnly, () => setFreeOnly(v => !v)],
            ['Friends in', friendsOnly, () => setFriendsOnly(v => !v)],
          ] as const).map(([label, on, toggle]) => (
            <button
              key={label}
              onClick={toggle}
              aria-pressed={on}
              className={`rounded-full px-3 py-1.5 font-sans text-[12px] font-semibold border-[1.5px] ${
                on ? 'bg-purple-100 border-purple-500 text-purple-700' : 'bg-white border-[#E8E4F5] text-ink-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-[calc(var(--nav-h)+22px+env(safe-area-inset-bottom))]">
        {loading ? (
          <div className="flex justify-center pt-16">
            <div className="w-8 h-8 rounded-full border-[3px] border-purple-100 border-t-purple-500 animate-spin" />
          </div>
        ) : hits.length === 0 ? (
          <div className="flex flex-col items-center text-center pt-11 px-7">
            <CowIllustration size={70} className="opacity-90" />
            <h3 className="font-display font-extrabold text-[17px] text-ink-900 mt-3.5 mb-1.5">
              {moves.length === 0 ? 'No moves near you yet.' : 'Nothing matches that.'}
            </h3>
            <p className="font-sans text-[13px] text-ink-500 leading-relaxed mb-4">
              {moves.length === 0
                ? 'New ones land here often. Check back soon.'
                : 'Try a wider stretch of the week, or drop a filter.'}
            </p>
            {filtered && (
              <button
                onClick={clearFilters}
                className="px-5 py-2.5 rounded-full bg-purple-500 text-white font-sans font-bold text-[13.5px]"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="font-sans text-[12px] text-ink-500 px-0.5 pt-3.5 pb-2.5">
              <b className="font-bold text-ink-900">{hits.length}</b>{' '}
              {hits.length === 1 ? 'move' : 'moves'} near you
            </p>
            {groups.map((group, gi) => (
              <div key={group.label ?? 'all'}>
                {group.label && (
                  <p
                    className={`font-sans text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-500 px-0.5 pb-2.5 ${
                      gi > 0 ? 'pt-4' : ''
                    }`}
                  >
                    {group.label}
                  </p>
                )}
                {group.moves.map(m => (
                  <MooveCard
                    key={m.id}
                    move={m}
                    onMakeMoove={handleMakeMoove}
                    onOpenDetail={setDetail}
                  />
                ))}
              </div>
            ))}
          </>
        )}
      </div>

      <BottomNav />

      <MooveDetailSheet
        move={detail}
        onClose={() => setDetail(null)}
        onInterestedChange={handleInterestedChange}
        onMakeMoove={handleMakeMoove}
      />
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  )
}
