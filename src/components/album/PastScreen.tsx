'use client'

// R39 — the Past Mooves page. Mockup: mooves-r39-past-page.html
//
// Every Moove you started or joined that is over, newest first, grouped by
// month under sticky labels. Pages of 20 load on their own as you near the
// bottom (keyset cursor, so nothing shifts under you). Search covers the name
// and the place across the whole history, on the server.
//
// A row opens R36's album sheet in place, over this page, so closing it leaves
// your scroll position and your search exactly where they were.
//
// No counts, no "new", no "you're all caught up": the end of the list just
// says where your history begins.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { initPostHog, posthog } from '@/lib/posthog'
import {
  PAST_SEARCH_MIN,
  pastMonthLabel,
  pastMonthYear,
  type PastMoove,
  type PastPage,
} from '@/lib/photos'
import BottomNav from '@/components/ui/BottomNav'
import CowIllustration from '@/components/ui/CowIllustration'
import AlbumSheet from './AlbumSheet'
import PastRow from './PastRow'

interface Me {
  id: string
  displayName: string | null
  avatarUrl: string | null
}

type Status = 'loading' | 'ready' | 'error'

const SEARCH_DEBOUNCE_MS = 250

/** Consecutive runs of the same month, in list order. */
function groupByMonth(moves: PastMoove[]): { label: string; moves: PastMoove[] }[] {
  const groups: { label: string; moves: PastMoove[] }[] = []
  for (const m of moves) {
    const label = pastMonthLabel(m.startAt)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.moves.push(m)
    else groups.push({ label, moves: [m] })
  }
  return groups
}

function SkeletonRow({ strip }: { strip: boolean }) {
  return (
    <div className="p-3">
      <div className="flex items-center gap-[11px]">
        <div className="w-[46px] h-[46px] rounded-[13px] bg-grey-100 animate-pulse" />
        <div className="flex-1">
          <div className="h-[13px] w-[70%] rounded-lg bg-grey-100 animate-pulse" />
          <div className="h-[10px] w-[45%] rounded-lg bg-grey-100 animate-pulse mt-[7px]" />
        </div>
      </div>
      {strip && (
        <div className="grid grid-cols-4 gap-1 mt-2.5">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="aspect-square rounded-[10px] bg-grey-100 animate-pulse" />
          ))}
        </div>
      )}
      <div className="h-[18px] w-[52%] rounded-full bg-grey-100 animate-pulse mt-2.5" />
    </div>
  )
}

function Spinner() {
  return <span className="w-4 h-4 rounded-full border-[2.2px] border-[#E8E4F5] border-t-purple-500 animate-spin" />
}

export default function PastScreen() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)

  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')

  const [moves, setMoves] = useState<PastMoove[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [moreStatus, setMoreStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  // The unsearched history has no rows at all: the empty state, with no search.
  const [historyEmpty, setHistoryEmpty] = useState(false)

  const [albumPlanId, setAlbumPlanId] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  // Each fetch carries a token; a response for an older query is dropped.
  const requestRef = useRef(0)
  const searchLoggedRef = useRef(false)

  useEffect(() => {
    initPostHog()
    posthog.capture('past_page_viewed')
    fetch('/api/users/me')
      .then(r => (r.ok ? (r.json() as Promise<Me>) : null))
      .then(data => {
        if (data) setMe({ id: data.id, displayName: data.displayName, avatarUrl: data.avatarUrl })
      })
      .catch(() => {})
  }, [])

  // Debounce the field into the query the list is fetched for.
  useEffect(() => {
    const trimmed = input.trim()
    const next = trimmed.length >= PAST_SEARCH_MIN ? trimmed : ''
    const t = window.setTimeout(() => setQuery(next), next ? SEARCH_DEBOUNCE_MS : 0)
    return () => window.clearTimeout(t)
  }, [input])

  const fetchPage = useCallback(async (q: string, cursor: string | null): Promise<PastPage> => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (cursor) params.set('cursor', cursor)
    const res = await fetch(`/api/plans/past?${params.toString()}`)
    if (!res.ok) throw new Error(`past ${res.status}`)
    return (await res.json()) as PastPage
  }, [])

  // First page, for every new query.
  const loadFirst = useCallback(
    async (q: string) => {
      const token = ++requestRef.current
      setStatus('loading')
      setMoreStatus('idle')
      try {
        const page = await fetchPage(q, null)
        if (token !== requestRef.current) return
        setMoves(page.moves)
        setNextCursor(page.nextCursor)
        if (!q) setHistoryEmpty(page.moves.length === 0)
        setStatus('ready')
        scrollRef.current?.scrollTo({ top: 0 })
      } catch {
        if (token === requestRef.current) setStatus('error')
      }
    },
    [fetchPage],
  )

  useEffect(() => {
    void loadFirst(query)
    if (query && !searchLoggedRef.current) {
      // Whether search gets used, never what was typed.
      searchLoggedRef.current = true
      posthog.capture('past_search_used')
    }
  }, [query, loadFirst])

  const loadMore = useCallback(async () => {
    if (!nextCursor || moreStatus === 'loading' || status !== 'ready') return
    const token = requestRef.current
    setMoreStatus('loading')
    try {
      const page = await fetchPage(query, nextCursor)
      if (token !== requestRef.current) return
      setMoves(prev => {
        const seen = new Set(prev.map(m => m.id))
        return [...prev, ...page.moves.filter(m => !seen.has(m.id))]
      })
      setNextCursor(page.nextCursor)
      setMoreStatus('idle')
    } catch {
      if (token === requestRef.current) setMoreStatus('error')
    }
  }, [fetchPage, moreStatus, nextCursor, query, status])

  // Auto-load as the bottom of the list comes near.
  useEffect(() => {
    const root = scrollRef.current
    const target = sentinelRef.current
    if (!root || !target || !nextCursor || moreStatus !== 'idle') return
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) void loadMore()
      },
      { root, rootMargin: '0px 0px 400px 0px' },
    )
    io.observe(target)
    return () => io.disconnect()
  }, [loadMore, moreStatus, nextCursor])

  // An album edit may change a row's thumbnails; refresh the rows in place
  // without resetting the list or the scroll.
  async function refreshLoaded() {
    try {
      const page = await fetchPage(query, null)
      setMoves(prev => {
        const fresh = new Map(page.moves.map(m => [m.id, m]))
        return prev.map(m => fresh.get(m.id) ?? m)
      })
    } catch {
      // stale thumbnails until the next visit, nothing worse
    }
  }

  function openAlbum(move: PastMoove) {
    posthog.capture('past_album_opened', { source: 'page' })
    setAlbumPlanId(move.id)
  }

  function goBack() {
    if (window.history.length > 1) router.back()
    else router.push('/feed')
  }

  const searching = query.length > 0
  const groups = groupByMonth(moves)
  const atEnd = status === 'ready' && moves.length > 0 && !nextCursor
  const earliest = moves[moves.length - 1]

  return (
    <div className="h-[100dvh] flex flex-col bg-purple-50">
      <header className="shrink-0 [--safe-pt-base:0.375rem] safe-area-pt px-3.5 bg-purple-50">
        <div className="flex items-center gap-2">
          <button
            onClick={goBack}
            aria-label="Back"
            className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center text-ink-900"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <h1 className="font-display font-extrabold text-[22px] tracking-tight text-ink-900">Past Mooves</h1>
        </div>
        <p className="font-sans text-[12.5px] leading-snug text-ink-500 mt-px">
          The Mooves you went to, and the photos from them.
        </p>

        {!historyEmpty && (
          <label
            className={`mt-3 flex items-center gap-2 h-[42px] px-3 rounded-xl bg-white border-[1.5px] ${
              input ? 'border-purple-500' : 'border-[#E8E4F5]'
            }`}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              className={input ? 'text-ink-900' : 'text-grey-300'}
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Search by name or place"
              maxLength={80}
              enterKeyHint="search"
              className="flex-1 min-w-0 bg-transparent outline-none font-sans text-[16px] text-ink-900 placeholder:text-grey-300 [&::-webkit-search-cancel-button]:hidden"
            />
            {input && (
              <button
                type="button"
                onClick={() => setInput('')}
                aria-label="Clear search"
                className="w-5 h-5 shrink-0 rounded-full bg-grey-300 flex items-center justify-center"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            )}
          </label>
        )}
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3.5 pb-[calc(var(--nav-h)+22px+env(safe-area-inset-bottom))]"
      >
        {status === 'loading' && (
          <>
            <div className="pt-3.5 pb-2 px-0.5">
              <div className="h-[9px] w-16 rounded bg-grey-100 animate-pulse" />
            </div>
            <div className="rounded-2xl border-[1.5px] border-[#E8E4F5] bg-white overflow-hidden divide-y divide-grey-100">
              <SkeletonRow strip />
              <SkeletonRow strip={false} />
              <SkeletonRow strip={false} />
            </div>
          </>
        )}

        {status === 'error' && (
          <div className="mt-4 rounded-2xl border-[1.5px] border-[#E8E4F5] bg-white px-4 py-5 text-center">
            <p className="font-sans text-[13.5px] font-semibold text-ink-900">Couldn&apos;t load your past Mooves</p>
            <p className="font-sans text-[12.5px] text-ink-500 mt-0.5">Check your connection and try again.</p>
            <button
              onClick={() => void loadFirst(query)}
              className="mt-3.5 px-[18px] py-2.5 rounded-full border-[1.5px] border-[#E8E4F5] bg-white font-sans font-bold text-[13px] text-purple-700"
            >
              Try again
            </button>
          </div>
        )}

        {status === 'ready' && historyEmpty && !searching && (
          <div className="flex flex-col items-center text-center px-[30px] pt-24">
            <CowIllustration size={64} />
            <h3 className="font-display font-extrabold text-[16px] tracking-tight text-ink-900 mt-3.5">
              Nothing here yet
            </h3>
            <p className="font-sans text-[13px] leading-relaxed text-ink-500 mt-1">
              Mooves you go to end up here, with their photos.
            </p>
          </div>
        )}

        {status === 'ready' && searching && moves.length === 0 && (
          <div className="flex flex-col items-center text-center px-[30px] pt-20">
            <h3 className="font-display font-extrabold text-[16px] tracking-tight text-ink-900 break-words max-w-full">
              No past Mooves match &ldquo;{query}&rdquo;
            </h3>
            <p className="font-sans text-[13px] leading-relaxed text-ink-500 mt-1">Try a place, or part of the name.</p>
            <button
              onClick={() => setInput('')}
              className="mt-3.5 px-[18px] py-2.5 rounded-full border-[1.5px] border-[#E8E4F5] bg-white font-sans font-bold text-[13px] text-purple-700"
            >
              Clear search
            </button>
          </div>
        )}

        {status === 'ready' &&
          groups.map(g => (
            <section key={g.label}>
              <h2 className="sticky top-0 z-[3] bg-purple-50 pt-3.5 pb-2 px-0.5 font-sans text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-500">
                {g.label}
              </h2>
              <div className="rounded-2xl border-[1.5px] border-[#E8E4F5] bg-white overflow-hidden divide-y divide-grey-100">
                {g.moves.map(m => (
                  <PastRow
                    key={m.id}
                    move={m}
                    meId={me?.id ?? ''}
                    highlight={searching ? query : undefined}
                    onOpen={openAlbum}
                  />
                ))}
              </div>
            </section>
          ))}

        {status === 'ready' && nextCursor && (
          <div ref={sentinelRef} className="pt-4 pb-1">
            {moreStatus === 'error' ? (
              <div className="flex items-center justify-center gap-2 font-sans text-[12px] font-semibold text-ink-500">
                Couldn&apos;t load
                <button onClick={() => void loadMore()} className="font-bold text-purple-700">
                  Try again
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 font-sans text-[12px] font-semibold text-ink-500">
                <Spinner />
                Loading more
              </div>
            )}
          </div>
        )}

        {atEnd && earliest && (
          <p className="text-center font-sans text-[12px] font-medium text-grey-300 pt-[18px] pb-1">
            {searching
              ? `${moves.length} past ${moves.length === 1 ? 'Moove' : 'Mooves'}`
              : `That's everything since ${pastMonthYear(earliest.startAt)}`}
          </p>
        )}
      </div>

      <BottomNav />

      {albumPlanId && me && (
        <AlbumSheet
          key={albumPlanId}
          planId={albumPlanId}
          meId={me.id}
          meName={me.displayName}
          meAvatar={me.avatarUrl}
          onClose={() => {
            setAlbumPlanId(null)
            void refreshLoaded()
          }}
          onChanged={() => void refreshLoaded()}
        />
      )}
    </div>
  )
}
