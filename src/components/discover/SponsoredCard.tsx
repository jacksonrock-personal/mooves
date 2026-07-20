'use client'

// Phase 13.3 — a sponsored move card with a subtle "Sponsored" label (guardrail
// #4: not a banner). "I'm interested" reveals details in-app + increments the
// aggregate count; "Go with friends" (13.8) launches it as the viewer's own
// green; "Get details" opens the sponsor link (aggregate click).

import { useState } from 'react'
import { interestLabel } from '@/lib/interests'
import { posthog } from '@/lib/posthog'

export interface SponsoredMove {
  id: string
  title: string
  description: string
  category: string
  brand: string | null
  timeText: string | null
  linkUrl: string | null
  imageUrl: string | null
  interestedByMe: boolean
}

interface SponsoredCardProps {
  move: SponsoredMove
  onInterestedChange: (id: string, interested: boolean) => void
  onGoWithFriends: (id: string) => void
}

export default function SponsoredCard({ move, onInterestedChange, onGoWithFriends }: SponsoredCardProps) {
  const [busy, setBusy] = useState(false)

  async function markInterested() {
    if (busy) return
    setBusy(true)
    onInterestedChange(move.id, true) // optimistic
    posthog.capture('sponsored_interested', { move: move.id })
    try {
      const res = await fetch(`/api/discover/${move.id}/interested`, { method: 'POST' })
      if (!res.ok) throw new Error('failed')
    } catch {
      onInterestedChange(move.id, false)
    } finally {
      setBusy(false)
    }
  }

  async function openLink() {
    posthog.capture('sponsored_click', { move: move.id })
    try {
      const res = await fetch(`/api/discover/${move.id}/click`, { method: 'POST' })
      const data = (await res.json()) as { linkUrl: string | null }
      if (data.linkUrl) window.open(data.linkUrl, '_blank', 'noopener,noreferrer')
    } catch {
      // ignore — click is best-effort
    }
  }

  return (
    <div className="bg-white border border-[#E8E4F5] rounded-[20px] overflow-hidden mb-3.5">
      {move.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={move.imageUrl} alt="" className="w-full h-24 object-cover" />
      )}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2.5">
          <span className="inline-flex items-center gap-1.5 bg-purple-100 text-purple-700 rounded-full px-2.5 py-1 text-[11px] font-bold">
            {interestLabel(move.category)}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-grey-300">
            {move.brand ? `Sponsored · ${move.brand}` : 'Sponsored'}
          </span>
        </div>

        <div className="font-display font-extrabold text-[17px] text-ink-900 leading-[1.2] tracking-[-0.01em]">
          {move.title}
        </div>

        {move.timeText && (
          <div className="flex items-center gap-1.5 text-[13px] text-ink-500 mt-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#6B628A" strokeWidth="2" />
              <path d="M12 7v5l3 2" stroke="#6B628A" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {move.timeText}
          </div>
        )}

        {!move.interestedByMe ? (
          <button
            onClick={() => void markInterested()}
            disabled={busy}
            className="w-full h-[46px] mt-3.5 rounded-full bg-purple-500 text-white font-sans font-semibold text-[15px] disabled:opacity-50"
          >
            I&apos;m interested
          </button>
        ) : (
          <div className="border-t border-[#E8E4F5] mt-3.5 pt-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.05em] text-grey-300 mb-1.5">✓ Interested</div>
            <p className="font-sans text-[13px] leading-relaxed text-ink-500">{move.description}</p>
            <button
              onClick={() => onGoWithFriends(move.id)}
              className="w-full h-[46px] mt-3.5 rounded-full bg-purple-500 text-white font-sans font-semibold text-[15px] flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="9" cy="9" r="3.2" stroke="#fff" strokeWidth="2" />
                <path d="M3.5 18a5.5 5.5 0 0 1 11 0" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                <path d="M16 6.5a3 3 0 0 1 0 5.8M18.5 18a5.5 5.5 0 0 0-3-4.9" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Go with friends
            </button>
            {move.linkUrl && (
              <button
                onClick={() => void openLink()}
                className="w-full h-[46px] mt-2.5 rounded-full bg-white border-[1.5px] border-purple-500 text-purple-700 font-sans font-semibold text-[15px]"
              >
                Get details ↗
              </button>
            )}
            <p className="text-[11.5px] text-ink-500 text-center mt-2.5 leading-tight">
              Go green with this move so friends can join you.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
