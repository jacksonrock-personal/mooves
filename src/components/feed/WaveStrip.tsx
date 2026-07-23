'use client'

// Phase 17.1 — in-app green wave strip. Shows at the top of the feed whenever the
// viewer has 3+ currently-green friends (derived entirely from the feed's existing
// green-friends list — no new fetch). Names up to 3 friends (+N others), never a
// bare count. "Start a plan" opens the prefilled wave blast (17.2). Dismissible.

import { useEffect } from 'react'
import Avatar from '@/components/ui/Avatar'
import { posthog } from '@/lib/posthog'
import { buildWaveBlastHref, WAVE_TIME_PHRASE, type WaveTime } from '@/lib/blast'
import { markValueMoment } from '@/lib/pwa'

export interface WaveFriend {
  id: string
  displayName: string | null
  avatarUrl: string | null
  phone: string
}

interface WaveStripProps {
  friends: WaveFriend[]
  timeBucket: WaveTime
  onDismiss: () => void
}

function nameLine(friends: WaveFriend[]): string {
  const shown = friends.slice(0, 3).map(f => f.displayName ?? 'A friend')
  if (shown.length >= 3) return `${shown[0]}, ${shown[1]}, and ${shown[2]}`
  if (shown.length === 2) return `${shown[0]} and ${shown[1]}`
  return shown[0] ?? ''
}

export default function WaveStrip({ friends, timeBucket, onDismiss }: WaveStripProps) {
  const extra = Math.max(0, friends.length - 3)

  useEffect(() => {
    posthog.capture('wave_strip_shown', { greenCount: friends.length, timeBucket })
  }, [friends.length, timeBucket])

  function startPlan() {
    const phones = friends.map(f => f.phone).filter(Boolean)
    if (phones.length === 0) return
    markValueMoment() // Phase 15.4: a value moment → may nudge to install
    posthog.capture('wave_blast_started', { greenCount: friends.length, timeBucket })
    window.location.href = buildWaveBlastHref(phones, timeBucket)
  }

  function dismiss() {
    posthog.capture('wave_strip_dismissed')
    onDismiss()
  }

  return (
    <div className="relative rounded-[20px] bg-white border-[1.5px] border-green-500/25 shadow-glow-green px-4 pt-4 pb-4 mb-5 animate-card-in">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-3 right-3 w-7 h-7 rounded-full bg-purple-50 text-ink-500 flex items-center justify-center"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>

      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_0_4px_rgba(46,204,113,0.16)]" />
        <span className="font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-green-700">Green wave</span>
      </div>

      <p className="font-display font-extrabold text-[18px] leading-tight text-ink-900 tracking-tight mb-3 pr-6">
        {nameLine(friends)} are free {WAVE_TIME_PHRASE[timeBucket]}.
      </p>

      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex">
          {friends.slice(0, 3).map((f, i) => (
            <div key={f.id} className={i === 0 ? '' : '-ml-2'}>
              <Avatar src={f.avatarUrl} name={f.displayName ?? 'Friend'} size={30} className="ring-2 ring-white" />
            </div>
          ))}
        </div>
        {extra > 0 && (
          <span className="font-sans text-[13px] font-medium text-ink-500">
            and {extra} {extra === 1 ? 'other' : 'others'}
          </span>
        )}
      </div>

      <button
        onClick={startPlan}
        className="w-full py-3.5 rounded-[14px] bg-purple-500 text-white font-display font-extrabold text-[15px] tracking-tight flex items-center justify-center gap-2"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        Start a plan
      </button>
    </div>
  )
}
