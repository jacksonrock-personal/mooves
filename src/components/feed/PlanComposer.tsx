'use client'

// Phase 20.3 / 20.9 — the Moove composer, used for both create and edit.
//
// A Moove has a day, a green does not. The DATE is the only required scheduling
// field; time, place and note are all optional, so "Sunday, long walk, lake
// path" is a legitimate Moove rather than one missing its time.
//
// Timestamps are computed here, client-side, from the author's local calendar —
// the server does not know their timezone and only sanity-bounds what it gets
// (same architecture as green expiry, 9.5 Part A).

import { useEffect, useMemo, useState } from 'react'
import { posthog } from '@/lib/posthog'
import { combineStartAt, splitStartAt } from '@/lib/movetime'
import { computePlanExpiry, PLAN_TITLE_MAX, PLAN_LOCATION_MAX, PLAN_NOTE_MAX, type Plan } from '@/lib/plans'

interface Group {
  id: string
  name: string
  emoji: string | null
}

/**
 * 13.8 — arriving from Discover's "Go with friends". Creates a Moove, not a
 * green: the whole point is bringing a dated thing to your friends, which is
 * what a Moove is. The sponsored move's details prefill the form, and its id
 * rides along so the friend-facing "Sponsored · brand" disclosure survives.
 */
export interface PlanPrefill {
  sponsoredMoveId: string
  title: string
  startAt: string | null
  locationText: string | null
  note: string | null
}

interface PlanComposerProps {
  open: boolean
  onClose: () => void
  groups: Group[]
  /** Present = edit mode. */
  editing?: Plan | null
  prefill?: PlanPrefill | null
  onSaved: () => void
}

export default function PlanComposer({
  open,
  onClose,
  groups,
  editing,
  prefill,
  onSaved,
}: PlanComposerProps) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [note, setNote] = useState('')
  const [visibleTo, setVisibleTo] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset (or prefill) every time the sheet opens.
  useEffect(() => {
    if (!open) return
    if (editing) {
      const parts = splitStartAt(editing.startAt)
      setTitle(editing.title)
      setDate(parts.date)
      setTime(editing.hasTime ? parts.time : '')
      setLocation(editing.locationText ?? '')
      setNote(editing.note ?? '')
      setVisibleTo([])
    } else if (prefill) {
      // A dated sponsored move already has everything the composer asks for.
      const parts = splitStartAt(prefill.startAt)
      setTitle(prefill.title)
      setDate(parts.date)
      setTime(parts.time)
      setLocation(prefill.locationText ?? '')
      setNote(prefill.note ?? '')
      setVisibleTo([])
    } else {
      setTitle('')
      setDate('')
      setTime('')
      setLocation('')
      setNote('')
      setVisibleTo([])
    }
    setError(null)
    posthog.capture(
      editing ? 'plan_edit_opened' : prefill ? 'plan_composer_prefilled' : 'plan_composer_opened',
      prefill ? { source: 'discover' } : undefined,
    )
  }, [open, editing, prefill])

  const canSave = useMemo(() => title.trim().length > 0 && date.length > 0, [title, date])

  async function handleSave() {
    if (!canSave || saving) return
    setSaving(true)
    setError(null)

    const hasTime = time.length > 0
    const startAt = combineStartAt(date, time)
    if (!startAt) {
      setError('That date did not look right.')
      setSaving(false)
      return
    }
    const expiresAt = computePlanExpiry(new Date(startAt), hasTime).toISOString()

    const payload = {
      title: title.trim(),
      startAt,
      hasTime,
      expiresAt,
      locationText: location.trim() || null,
      note: note.trim() || null,
      visibleTo: visibleTo.length > 0 ? visibleTo : null,
      // Carries 13.8's disclosure requirement through to the friend feed.
      sponsoredMoveId: !editing && prefill ? prefill.sponsoredMoveId : null,
    }

    try {
      const res = editing
        ? await fetch(`/api/plans/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

      if (!res.ok) {
        setError("That didn't save, try again.")
        setSaving(false)
        return
      }
      posthog.capture(editing ? 'plan_edited' : 'plan_created', { hasTime })
      onSaved()
      onClose()
    } catch {
      setError("That didn't save, try again.")
    } finally {
      setSaving(false)
    }
  }

  function toggleGroup(id: string) {
    setVisibleTo(prev => (prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]))
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-text-primary/50 z-40" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-card-white rounded-t-3xl flex flex-col max-h-[90%]"
        role="dialog"
        aria-modal="true"
      >
        {/* Escaping this sheet was impossible on device: it fills ~90% of the
            screen, so there was almost no scrim left to tap. Three ways out now
            — drag the grabber down, tap Cancel, or tap what scrim there is. */}
        <div
          className="shrink-0 pt-3 cursor-grab touch-none"
          onPointerDown={e => {
            const startY = e.clientY
            const el = e.currentTarget.parentElement
            const onMove = (ev: PointerEvent) => {
              const dy = Math.max(0, ev.clientY - startY)
              if (el) el.style.transform = `translateY(${dy}px)`
            }
            const onUp = (ev: PointerEvent) => {
              window.removeEventListener('pointermove', onMove)
              window.removeEventListener('pointerup', onUp)
              if (el) el.style.transform = ''
              if (ev.clientY - startY > 90) onClose()
            }
            window.addEventListener('pointermove', onMove)
            window.addEventListener('pointerup', onUp)
          }}
        >
          <div className="w-9 h-1 rounded-full bg-[#E8E4F5] mx-auto" />
        </div>
        <div className="shrink-0 px-5 pt-3">
          <div className="flex items-start gap-3 mb-1.5">
            <h2 className="flex-1 font-display font-extrabold text-[18px] text-text-primary tracking-tight">
              {editing ? 'Edit your Moove' : 'Plan a Moove'}
            </h2>
            <button
              onClick={onClose}
              className="shrink-0 -mt-0.5 font-sans text-[14px] font-semibold text-text-secondary"
            >
              Cancel
            </button>
          </div>
          <p className="font-sans text-[13.5px] text-text-secondary leading-relaxed mb-4">
            {editing
              ? `${editing.joiners.length} ${editing.joiners.length === 1 ? 'person is' : 'people are'} in. They won't be notified about edits, only if you cancel.`
              : 'Something with a day on it. This does not make you free right now.'}
          </p>
        </div>

        {/* The form scrolls; the commit button never does. */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5">
          <Label>What is it</Label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value.slice(0, PLAN_TITLE_MAX))}
            placeholder="Climbing, dinner, trivia night"
            className="w-full min-h-[46px] rounded-2xl border-[1.5px] border-[#E8E4F5] bg-surface-bg px-3.5 py-3 font-sans text-[16px] text-ink-900 outline-none mb-4 focus:border-purple-500"
          />

          <Label>When</Label>
          <div className="flex gap-2 mb-4">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="flex-1 min-w-0 min-h-[46px] rounded-2xl border-[1.5px] border-[#E8E4F5] bg-surface-bg px-3.5 py-3 font-sans text-[16px] text-ink-900 outline-none focus:border-purple-500"
            />
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="flex-1 min-w-0 min-h-[46px] rounded-2xl border-[1.5px] border-[#E8E4F5] bg-surface-bg px-3.5 py-3 font-sans text-[16px] text-ink-900 outline-none focus:border-purple-500"
            />
          </div>

          <Label optional>Where</Label>
          <input
            value={location}
            onChange={e => setLocation(e.target.value.slice(0, PLAN_LOCATION_MAX))}
            placeholder="First Ascent, Avondale"
            className="w-full min-h-[46px] rounded-2xl border-[1.5px] border-[#E8E4F5] bg-surface-bg px-3.5 py-3 font-sans text-[16px] text-ink-900 outline-none mb-4 focus:border-purple-500"
          />

          <Label optional>Anything else</Label>
          <input
            value={note}
            onChange={e => setNote(e.target.value.slice(0, PLAN_NOTE_MAX))}
            placeholder="Bring shoes if you have them"
            className="w-full min-h-[46px] rounded-2xl border-[1.5px] border-[#E8E4F5] bg-surface-bg px-3.5 py-3 font-sans text-[16px] text-ink-900 outline-none mb-4 focus:border-purple-500"
          />

          <Label>Who can see this?</Label>
          <div className="flex gap-2 flex-wrap mb-4">
            <Chip on={visibleTo.length === 0} onClick={() => setVisibleTo([])}>
              Everyone
            </Chip>
            {groups.map(g => (
              <Chip key={g.id} on={visibleTo.includes(g.id)} onClick={() => toggleGroup(g.id)}>
                {g.emoji ? `${g.emoji} ` : ''}
                {g.name}
              </Chip>
            ))}
          </div>

          {error && <p className="font-sans text-[13px] text-[#E8405A] mb-3">{error}</p>}
        </div>

        <div className="shrink-0 px-5 pt-3 border-t border-grey-100 [--safe-pb-base:1.375rem] safe-area-pb">
          <button
            onClick={() => void handleSave()}
            disabled={!canSave || saving}
            className="w-full py-[15px] rounded-2xl bg-purple-500 text-white font-display font-extrabold text-[15.5px] tracking-tight shadow-[0_6px_18px_rgba(124,92,219,0.3)] disabled:opacity-40 disabled:shadow-none"
          >
            {editing ? 'Save changes' : 'Post this Moove'}
          </button>
        </div>
      </div>
    </>
  )
}

function Label({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary mb-2">
      {children}
      {optional && <span className="normal-case tracking-normal font-normal"> (optional)</span>}
    </p>
  )
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-2 rounded-full font-sans text-[12.5px] font-semibold border-[1.5px] ${
        on
          ? 'bg-purple-100 border-purple-500 text-purple-700'
          : 'bg-card-white border-[#E8E4F5] text-text-secondary'
      }`}
    >
      {children}
    </button>
  )
}
