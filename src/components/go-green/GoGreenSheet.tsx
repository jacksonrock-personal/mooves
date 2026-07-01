'use client'

// Screen 5: Go Green Sheet — status note + visibility (Amendment B: chips, not checkboxes)

import { useEffect, useState } from 'react'
import Sheet from '@/components/ui/Sheet'
import VisibilityChips from './VisibilityChips'
import { posthog } from '@/lib/posthog'

interface Group {
  id: string
  name: string
  emoji: string
}

interface GoGreenSheetProps {
  open: boolean
  onClose: () => void
  groups: Group[]
  onSuccess: (statusNote: string | null) => void
}

export default function GoGreenSheet({ open, onClose, groups, onSuccess }: GoGreenSheetProps) {
  const [note, setNote] = useState('')
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setNote('')
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
          visibleTo,
        }),
      })
      if (!res.ok) throw new Error('update failed')
      const data = await res.json() as { statusNote: string | null }

      posthog.capture('go_green_confirmed')
      if (trimmedNote) posthog.capture('go_green_with_note')
      if (visibleTo) posthog.capture('go_green_with_groups')

      onSuccess(data.statusNote)
    } catch {
      setError("Couldn't update, try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} className="px-5 pb-6">
      <p className="font-sans text-[11px] font-semibold text-text-secondary uppercase tracking-[0.08em] mb-2.5">
        What&apos;s the vibe?
      </p>
      <input
        type="text"
        value={note}
        onChange={e => setNote(e.target.value.slice(0, 60))}
        placeholder="up for anything, drinks?, etc."
        autoFocus
        className={`w-full h-[52px] rounded-2xl border-2 bg-surface-bg px-4 font-sans text-[15px] text-text-primary placeholder:text-status-grey outline-none transition-colors mb-5 ${
          note ? 'border-mooves-purple' : 'border-[#E8E4F5] focus:border-mooves-purple'
        }`}
      />

      {groups.length > 0 && (
        <>
          <p className="font-sans text-[11px] font-semibold text-text-secondary uppercase tracking-[0.08em] mb-2.5">
            Who can see you?
          </p>
          <div className="mb-5">
            <VisibilityChips
              groups={groups}
              selected={selectedGroupIds}
              onChange={setSelectedGroupIds}
            />
          </div>
        </>
      )}

      {error && (
        <p className="font-sans text-[13px] text-[#E8405A] mb-3">{error}</p>
      )}

      <button
        onClick={() => void handleConfirm()}
        disabled={submitting}
        className="w-full py-4 rounded-2xl bg-status-green text-white font-display font-extrabold text-[17px] tracking-tight shadow-[0_4px_20px_rgba(46,204,113,0.3)] disabled:opacity-60"
      >
        {submitting ? 'Saving…' : "I'm free"}
      </button>
    </Sheet>
  )
}
