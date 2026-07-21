'use client'

// Screen 5: Go Green Sheet — vibe note + time chip (9.1) + visibility.
// Opened by the swipe-to-go-green control on the feed (amendment A1); the "I'm
// free" button here is the commit.

import { useEffect, useState } from 'react'
import Sheet from '@/components/ui/Sheet'
import { useKeyboardInset } from '@/lib/useKeyboardInset'
import VisibilityChips from './VisibilityChips'
import TimeChips, { type StatusTime } from './TimeChips'
import { posthog } from '@/lib/posthog'

interface Group {
  id: string
  name: string
  emoji: string
}

interface AnchoredMove {
  id: string
  title: string
  brand: string | null
  timeText: string | null
}

interface GoGreenSheetProps {
  open: boolean
  onClose: () => void
  groups: Group[]
  anchoredMove?: AnchoredMove | null
  onSuccess: (move: { statusNote: string | null; statusTime: string | null }) => void
}

export default function GoGreenSheet({ open, onClose, groups, anchoredMove, onSuccess }: GoGreenSheetProps) {
  const [note, setNote] = useState('')
  const [time, setTime] = useState<StatusTime | null>(null)
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const keyboardInset = useKeyboardInset(open)

  useEffect(() => {
    if (open) {
      setNote('')
      setTime(null)
      setSelectedGroupIds([])
      setError(null)
    }
  }, [open])

  async function handleConfirm() {
    if (submitting) return
    setSubmitting(true)
    setError(null)

    const trimmedNote = note.trim()
    const visibleTo = selectedGroupIds.length > 0 ? selectedGroupIds : null

    try {
      const res = await fetch('/api/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isAvailable: true,
          statusNote: trimmedNote || null,
          statusTime: time,
          visibleTo,
          statusMoveId: anchoredMove?.id ?? null,
        }),
      })
      if (!res.ok) throw new Error('update failed')
      const data = await res.json() as { statusNote: string | null; statusTime: string | null }

      posthog.capture('go_green_confirmed')
      if (trimmedNote) posthog.capture('go_green_with_note')
      if (time) posthog.capture('go_green_with_time')
      if (visibleTo) posthog.capture('go_green_with_groups')
      if (anchoredMove) posthog.capture('go_green_with_move', { move: anchoredMove.id })

      onSuccess({ statusNote: data.statusNote, statusTime: data.statusTime })
    } catch {
      setError("Couldn't update, try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} bottomInset={keyboardInset} className="px-5 pb-6">
      {/* Scrollable body: with the keyboard up the sheet is lifted above it (bottomInset),
          and this region scrolls if the content is taller than the space that remains. */}
      <div className="max-h-[52vh] overflow-y-auto">
        {anchoredMove && (
          <div className="flex items-center gap-3 border border-[#E8E4F5] rounded-2xl p-3 bg-purple-50 mb-5">
            <span className="w-9 h-9 rounded-[10px] bg-purple-100 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 18V5l12-2v13" stroke="#7C5CDB" strokeWidth="2" strokeLinejoin="round" /><circle cx="6" cy="18" r="3" stroke="#7C5CDB" strokeWidth="2" /><circle cx="18" cy="16" r="3" stroke="#7C5CDB" strokeWidth="2" /></svg>
            </span>
            <div className="min-w-0">
              <div className="font-sans font-bold text-[13.5px] text-ink-900 leading-tight truncate">{anchoredMove.title}</div>
              <div className="font-sans text-[11.5px] text-ink-500 mt-0.5 truncate">
                {[anchoredMove.brand ? `Sponsored · ${anchoredMove.brand}` : 'Sponsored', anchoredMove.timeText].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
        )}
        <p className="font-sans text-[11px] font-semibold text-ink-500 uppercase tracking-[0.08em] mb-2.5">
          What&apos;s the vibe?
        </p>
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value.slice(0, 60))}
          placeholder="up for anything, drinks?, etc."
          className={`w-full h-[52px] rounded-2xl border-2 bg-purple-50 px-4 font-sans text-[16px] text-ink-900 placeholder:text-grey-300 outline-none transition-colors mb-5 ${
            note ? 'border-purple-500' : 'border-[#E8E4F5] focus:border-purple-500'
          }`}
        />

        <p className="font-sans text-[11px] font-semibold text-ink-500 uppercase tracking-[0.08em] mb-2.5">
          When?
        </p>
        <div className="mb-5">
          <TimeChips selected={time} onChange={setTime} />
        </div>

        {groups.length > 0 && (
          <>
            <p className="font-sans text-[11px] font-semibold text-ink-500 uppercase tracking-[0.08em] mb-2.5">
              Who can see you?
            </p>
            <div className="mb-1">
              <VisibilityChips
                groups={groups}
                selected={selectedGroupIds}
                onChange={setSelectedGroupIds}
              />
            </div>
          </>
        )}
      </div>

      {error && (
        <p className="font-sans text-[13px] text-red-500 mt-4 mb-1">{error}</p>
      )}

      {/* CTA stays pinned below the scroll region, above the keyboard. */}
      <button
        onClick={() => void handleConfirm()}
        disabled={submitting}
        className="w-full mt-4 py-4 rounded-2xl bg-green-700 text-white font-display font-extrabold text-[17px] tracking-tight shadow-[0_4px_20px_rgba(22,122,67,0.28)] disabled:opacity-60"
      >
        {submitting ? 'Saving…' : "I'm free"}
      </button>
    </Sheet>
  )
}
