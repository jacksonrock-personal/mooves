'use client'

// Phase 13.8 — the compact sponsored move anchored to a green, as it appears on
// the friend feed (and the mover's own card). Subtle "Sponsored · brand"
// disclosure; details + sponsor link on tap (aggregate click counted).

import { useState } from 'react'
import { interestLabel } from '@/lib/interests'
import { posthog } from '@/lib/posthog'

export interface AnchoredMove {
  id: string
  title: string
  description: string
  brand: string | null
  category: string
  timeText: string | null
  linkUrl: string | null
}

export default function AnchoredMoveCard({ move }: { move: AnchoredMove }) {
  const [open, setOpen] = useState(false)

  async function openLink() {
    posthog.capture('sponsored_click', { move: move.id })
    try {
      const res = await fetch(`/api/discover/${move.id}/click`, { method: 'POST' })
      const data = (await res.json()) as { linkUrl: string | null }
      if (data.linkUrl) window.open(data.linkUrl, '_blank', 'noopener,noreferrer')
    } catch {
      // best-effort
    }
  }

  return (
    <div className="mt-3 border border-[#E8E4F5] rounded-[14px] p-3 bg-white/70">
      <div className="flex items-center justify-between mb-1.5">
        <span className="inline-flex items-center bg-purple-100 text-purple-700 rounded-full px-2 py-0.5 text-[10px] font-bold">
          {interestLabel(move.category)}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-grey-300">
          {move.brand ? `Sponsored · ${move.brand}` : 'Sponsored'}
        </span>
      </div>
      <div className="font-display font-extrabold text-[14.5px] text-ink-900 leading-tight">{move.title}</div>
      {move.timeText && <div className="text-[12.5px] text-ink-500 mt-1">{move.timeText}</div>}
      {!open ? (
        <button onClick={() => setOpen(true)} className="text-[11.5px] font-semibold text-purple-700 mt-2">
          Tap for details ›
        </button>
      ) : (
        <div className="mt-2">
          <p className="text-[12.5px] leading-relaxed text-ink-500">{move.description}</p>
          {move.linkUrl && (
            <button onClick={() => void openLink()} className="text-[12px] font-semibold text-purple-700 mt-2">
              Get details ↗
            </button>
          )}
        </div>
      )}
    </div>
  )
}
