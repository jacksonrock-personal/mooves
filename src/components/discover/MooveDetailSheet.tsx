'use client'

// Phase 24.7/24.8 — the detail sheet behind a card.
//
// This exists because of a rule, not because a screen needed splitting. The card
// carries ONE button, always ("Make it a Moove"), so everything else a person
// might want has to live somewhere else: the full description, the link out, and
// — the reason this file was written — "I'd go".
//
// "I'd go" replaces "I'm interested", which was the worst control in the old
// Discover: it gated the action that actually mattered behind a tap that did
// nothing for the user. Here it gates nothing. The card's CTA is live whether or
// not anyone has ever tapped this, and what this produces is the social proof
// other people see ("Maya and Dev would go" — the card echoes the verb from the
// button, because that tap is all anyone actually did).
//
// Wall 2 (24.0) holds here: tapping it is visible to CONFIRMED FRIENDS only.
// Never public, never the sponsor, never a stranger in the same metro.

import { useState } from 'react'
import Sheet from '@/components/ui/Sheet'
import { posthog } from '@/lib/posthog'
import type { NearMove } from '@/app/api/discover/route'

interface MooveDetailSheetProps {
  move: NearMove | null
  onClose: () => void
  onInterestedChange: (id: string, interested: boolean) => void
  onMakeMoove: (move: NearMove) => void
}

export default function MooveDetailSheet({
  move,
  onClose,
  onInterestedChange,
  onMakeMoove,
}: MooveDetailSheetProps) {
  const [busy, setBusy] = useState(false)
  if (!move) return null

  const paid = move.origin === 'sponsor'

  async function toggleIdGo() {
    if (!move || busy) return
    const next = !move.interestedByMe
    setBusy(true)
    onInterestedChange(move.id, next) // optimistic
    posthog.capture(next ? 'move_id_go' : 'move_id_go_undone', {
      move: move.id,
      origin: move.origin,
    })
    try {
      const res = await fetch(`/api/discover/${move.id}/interested`, {
        method: next ? 'POST' : 'DELETE',
      })
      if (!res.ok) throw new Error('failed')
    } catch {
      onInterestedChange(move.id, !next) // roll back
    } finally {
      setBusy(false)
    }
  }

  async function openLink() {
    if (!move?.linkUrl) return
    posthog.capture('sponsored_click', { move: move.id })
    try {
      await fetch(`/api/discover/${move.id}/click`, { method: 'POST' })
    } catch {
      // click is best-effort; never block the navigation on it
    }
    window.open(move.linkUrl, '_blank', 'noopener,noreferrer')
  }

  const facts = [move.timeText, move.neighborhood, move.priceText].filter(Boolean) as string[]

  return (
    <Sheet open={!!move} onClose={onClose} className="px-5 pb-6">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-[3px] font-sans text-[9.5px] font-bold uppercase tracking-[0.06em] ${
          paid ? 'bg-purple-100 text-purple-700' : 'bg-grey-100 text-ink-500'
        }`}
      >
        <span className={`w-[5px] h-[5px] rounded-full ${paid ? 'bg-purple-500' : 'bg-grey-300'}`} />
        {paid ? `Sponsored${move.brand ? ` · ${move.brand}` : ''}` : 'Community Moove'}
      </span>

      <h2 className="font-display font-extrabold text-[20px] text-ink-900 tracking-[-0.02em] leading-[1.2] mt-2.5">
        {move.title}
      </h2>

      {facts.length > 0 && (
        <div className="flex items-center gap-[7px] flex-wrap mt-2 font-sans text-[13px] text-ink-500">
          {facts.map((f, i) => (
            <span key={f} className="flex items-center gap-[7px]">
              {i > 0 && <span className="w-[3px] h-[3px] rounded-full bg-grey-300" />}
              {f}
            </span>
          ))}
        </div>
      )}

      {move.locationText && (
        <p className="font-sans text-[13px] text-ink-500 mt-1.5">{move.locationText}</p>
      )}

      {/* The full description lives here rather than on the card, which carries
          only a blurb. A list of paragraphs is not scannable. */}
      {move.description && (
        <p className="font-sans text-[13.5px] text-ink-500 leading-relaxed mt-3.5">
          {move.description}
        </p>
      )}

      <button
        onClick={() => onMakeMoove(move)}
        className="w-full mt-5 py-[15px] rounded-2xl bg-purple-500 text-white font-display font-extrabold text-[15.5px] tracking-[-0.02em]"
      >
        Make it a Moove
      </button>

      {/* Not a competing CTA — a signal. It commits you to nothing and produces
          the line your friends see. */}
      <button
        onClick={() => void toggleIdGo()}
        disabled={busy}
        aria-pressed={move.interestedByMe}
        className={`w-full mt-2.5 py-3.5 rounded-2xl font-sans font-semibold text-[14.5px] disabled:opacity-50 ${
          move.interestedByMe
            ? 'bg-green-100 text-green-700'
            : 'bg-purple-50 text-ink-500 border-[1.5px] border-[#E8E4F5]'
        }`}
      >
        {move.interestedByMe ? "✓ You'd go" : "I'd go"}
      </button>
      <p className="font-sans text-[11.5px] text-grey-300 text-center mt-2 leading-tight">
        Only your friends can see this.
      </p>

      {/* Sponsors get a link out. Seeded Community Mooves get their source
          instead, which is the row's provenance rather than an ad destination. */}
      {paid && move.linkUrl ? (
        <button
          onClick={() => void openLink()}
          className="w-full mt-3 py-3 rounded-2xl bg-white border-[1.5px] border-purple-500 text-purple-700 font-sans font-semibold text-[14.5px]"
        >
          Get details ↗
        </button>
      ) : move.sourceUrl ? (
        <a
          href={move.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full mt-3 text-center font-sans text-[12.5px] font-medium text-ink-500 underline decoration-grey-300 underline-offset-2"
        >
          Where this came from ↗
        </a>
      ) : null}
    </Sheet>
  )
}
