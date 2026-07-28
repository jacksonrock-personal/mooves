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
import { useSheetDrag } from '@/lib/useSheetDrag'
import SheetGrabber from '@/components/ui/SheetGrabber'
import { combineStartAt, splitStartAt } from '@/lib/movetime'
import {
  computePlanExpiry,
  coarseSortAt,
  coarseExpiry,
  isCoarse,
  isWeekModeAvailable,
  COARSE_MODES,
  TIME_MODE_LABEL,
  PLAN_TITLE_MAX,
  PLAN_LOCATION_MAX,
  PLAN_NOTE_MAX,
  type Plan,
  type PlanTimeMode,
} from '@/lib/plans'

interface Group {
  id: string
  name: string
  emoji: string | null
}

// R3 — the resting-state hints. These render the value the picker returned in
// the same shape the placeholder promised, so the field never changes format
// between "7/29" and what you get after choosing.
function formatDateHint(value: string): string {
  const [, m, d] = value.split('-').map(Number)
  return Number.isFinite(m) && Number.isFinite(d) ? `${m}/${d}` : value
}

function formatTimeHint(value: string): string {
  const [h, min] = value.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(min)) return value
  const suffix = h < 12 ? 'AM' : 'PM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(min).padStart(2, '0')} ${suffix}`
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
  const [showGroups, setShowGroups] = useState(false)
  // Coarse is the default; `exact` swaps the chips for real pickers.
  //
  // R3 — starts NULL rather than preselected. A preselected chip meant "When"
  // was already satisfied the instant the sheet opened, which under R2's step
  // gating would flash step 2 past and dump the whole form at once. The cost,
  // recorded deliberately: posting goes from one required field to two.
  const [mode, setMode] = useState<PlanTimeMode | null>(null)
  const [exact, setExact] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const drag = useSheetDrag(onClose)

  // Reset (or prefill) every time the sheet opens.
  useEffect(() => {
    if (!open) return
    if (editing) {
      const parts = splitStartAt(editing.startAt)
      const coarse = isCoarse(editing.timeMode)
      setTitle(editing.title)
      setExact(!coarse)
      setMode(editing.timeMode)
      setDate(coarse ? '' : parts.date)
      setTime(coarse || !editing.hasTime ? '' : parts.time)
      setLocation(editing.locationText ?? '')
      setNote(editing.note ?? '')
      // Restore what the Moove is ACTUALLY scoped to. This used to reset to []
      // unconditionally, because get_plans only returned group NAMES and there
      // was nothing to restore from — so every edit opened on "Everyone" and
      // then saved that over the truth, quietly widening a group-scoped Moove
      // to all of the author's friends. `visibleTo` is now returned to the
      // author for exactly this.
      setVisibleTo(editing.visibleTo ?? [])
      setShowGroups(editing.showGroups)
    } else if (prefill) {
      // A dated sponsored move already has everything the composer asks for.
      // A sponsored move already has a real date and time, so it opens exact.
      const parts = splitStartAt(prefill.startAt)
      setTitle(prefill.title)
      setExact(!!prefill.startAt)
      setMode('datetime')
      setDate(parts.date)
      setTime(parts.time)
      setLocation(prefill.locationText ?? '')
      setNote(prefill.note ?? '')
      setVisibleTo([])
      setShowGroups(false)
    } else {
      setTitle('')
      setExact(false)
      setMode(null) // R3 — nothing preselected, so picking one is a real step
      setDate('')
      setTime('')
      setLocation('')
      setNote('')
      setVisibleTo([])
      setShowGroups(false)
    }
    setError(null)
    posthog.capture(
      editing ? 'plan_edit_opened' : prefill ? 'plan_composer_prefilled' : 'plan_composer_opened',
      prefill ? { source: 'discover' } : undefined,
    )
  }, [open, editing, prefill])

  // ── R2, the step gate ──────────────────────────────────────────────────────
  //
  // Editing and a Discover prefill both BYPASS it: progressive disclosure helps
  // a blank form and obstructs a full one, and both of those arrive populated.
  const gated = !editing && !prefill

  const hasTitle = title.trim().length > 0
  /** Step 2 is satisfied by a coarse chip, or by a date in exact mode. */
  const timeChosen = exact ? date.length > 0 : mode !== null

  const showWhen = !gated || hasTitle
  const showRest = !gated || (hasTitle && timeChosen)

  const canSave = useMemo(
    () => title.trim().length > 0 && (exact ? date.length > 0 : mode !== null),
    [title, exact, date, mode],
  )

  async function handleSave() {
    if (!canSave || saving) return
    setSaving(true)
    setError(null)

    const hasTime = exact && time.length > 0
    // canSave guarantees a mode in the coarse branch; the fallback only exists
    // so the type is honest.
    const timeMode: PlanTimeMode = exact ? (hasTime ? 'datetime' : 'date') : (mode ?? 'weekend')

    // Coarse Mooves have no real start, so start_at is a SORT KEY stamped at
    // the end of the window — that is what puts "Saturday 9am" above "sometime
    // this weekend".
    let startAt: string | null
    let expiresAt: string
    if (exact) {
      startAt = combineStartAt(date, time)
      if (!startAt) {
        setError('That date did not look right.')
        setSaving(false)
        return
      }
      expiresAt = computePlanExpiry(new Date(startAt), hasTime).toISOString()
    } else {
      startAt = coarseSortAt(timeMode).toISOString()
      expiresAt = coarseExpiry(timeMode).toISOString()
    }

    const payload = {
      title: title.trim(),
      startAt,
      hasTime,
      timeMode,
      showGroups: visibleTo.length > 0 && showGroups,
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
      <div
        className="fixed inset-0 bg-text-primary/50 z-40"
        style={{ opacity: drag.scrimOpacity }}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* ONE HEIGHT, always. It was max-h-[90%] over a form that mounted and
          unmounted its own steps, so the sheet's top edge and the Post button
          jumped every time a step unlocked — the sheet grew under your thumb
          while you were still typing. 86% is sized to hold the fully expanded
          form (title, When in its taller exact-picker state, visibility with
          the group toggle showing, Where, Anything else) on a modern phone;
          anything past that scrolls inside the frame. Nothing rendered inside
          can move this number. */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-card-white rounded-t-3xl flex flex-col h-[86%]"
        role="dialog"
        aria-modal="true"
        {...drag.sheetProps}
      >
        {/* Escaping this sheet was impossible on device: it fills ~86% of the
            screen, so there is almost no scrim left to tap. Three ways out —
            drag it down, tap Cancel, or tap what scrim there is.

            The drag target is no longer the 9x4px pill. It is the grabber's
            36px band PLUS the whole header below, so the top ~130px of this
            sheet dismisses it. The heading and its blurb have nothing else to
            do with a touch, and this is the sheet where being trapped hurt
            most. */}
        <SheetGrabber drag={drag} className="mt-[18px]" />
        <div className="shrink-0 px-5 pt-3" {...drag.headerProps}>
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
              : 'Got something in mind? Throw it out there! This does not make you free right now.'}
          </p>
        </div>

        {/* The form scrolls; the commit button never does. It is also the third
            drag target — but only from the very top of the scroll and only
            downward, so scrolling back up through the form never yanks the
            sheet away underneath you. */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5" {...drag.contentProps}>
          <Label>What is it</Label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value.slice(0, PLAN_TITLE_MAX))}
            placeholder="Climbing, dinner, trivia night"
            className="w-full min-h-[46px] rounded-2xl border-[1.5px] border-[#E8E4F5] bg-surface-bg px-3.5 py-3 font-sans text-[16px] text-ink-900 outline-none mb-4 focus:border-purple-500"
          />

          {/* Coarse by default. "Climbing this weekend" is a complete Moove, so
              the exact date and time hide behind a "+" rather than sitting there
              as two blank boxes that look required. One or the other, never
              both, so the card always knows which to render. */}
          <Step shown={showWhen}>
            <div>
              <Label>When</Label>
              {!exact && (
                <>
                  <div className="flex gap-2 flex-wrap mb-3">
                    {COARSE_MODES.filter(m => m !== 'week' || isWeekModeAvailable()).map(m => (
                      <Chip
                        key={m}
                        on={mode === m}
                        onClick={() => {
                          setMode(m)
                          if (gated && mode === null) posthog.capture('plan_composer_step_advanced', { step: 2 })
                        }}
                      >
                        {TIME_MODE_LABEL[m]}
                      </Chip>
                    ))}
                  </div>
                  <button
                    onClick={() => setExact(true)}
                    className="flex items-center gap-1.5 font-sans text-[12.5px] font-semibold text-purple-500 mb-4"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add an exact date and time
                  </button>
                </>
              )}

              {exact && (
                <>
                  {/* R3 — iOS ignores `placeholder` on date and time inputs, which is
                      exactly why these shipped as two blank boxes. The native input is
                      kept (so the wheel picker still opens on tap) but made fully
                      transparent and laid over a span we control, which gives the
                      resting state a real hint instead of nothing. */}
                  <div className="flex gap-2 mb-3">
                    <span className="relative flex-1 min-w-0">
                      <span
                        className={`block min-h-[46px] rounded-2xl border-[1.5px] border-[#E8E4F5] bg-surface-bg px-3.5 py-3 font-sans text-[16px] ${
                          date ? 'text-ink-900' : 'text-grey-300'
                        }`}
                      >
                        {date ? formatDateHint(date) : '7/29'}
                      </span>
                      <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        aria-label="Date"
                        className="absolute inset-0 w-full h-full opacity-0"
                      />
                    </span>
                    <span className="relative flex-1 min-w-0">
                      <span
                        className={`block min-h-[46px] rounded-2xl border-[1.5px] border-[#E8E4F5] bg-surface-bg px-3.5 py-3 font-sans text-[16px] ${
                          time ? 'text-ink-900' : 'text-grey-300'
                        }`}
                      >
                        {time ? formatTimeHint(time) : '10:30 AM'}
                      </span>
                      <input
                        type="time"
                        value={time}
                        onChange={e => setTime(e.target.value)}
                        aria-label="Time"
                        className="absolute inset-0 w-full h-full opacity-0"
                      />
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      // Clearing both is what makes the two modes mutually
                      // exclusive in BOTH directions — otherwise a stale date
                      // would keep step 2 satisfied after switching back.
                      setExact(false)
                      setDate('')
                      setTime('')
                    }}
                    className="flex items-center gap-1.5 font-sans text-[12.5px] font-semibold text-text-secondary mb-4"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Use a rough time instead
                  </button>
                </>
              )}
            </div>
          </Step>

          {/* R4 — visibility sits directly under When, ahead of the two optional
              fields. It is the only one of the three that changes who the Moove
              reaches; under Where and Anything else it read as an afterthought. */}
          <Step shown={showRest} stagger>
            <div>
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

              {/* 18.2's toggle, reused. Appears only once a group is picked, and
                  defaults off. It belongs directly under the chips it qualifies —
                  see the block below, which is now unreachable and removed. */}
              {visibleTo.length > 0 && (
                <button
                  onClick={() => setShowGroups(s => !s)}
                  role="switch"
                  aria-checked={showGroups}
                  className="w-full flex items-center gap-2.5 border border-[#E8E4F5] bg-surface-bg rounded-2xl px-3.5 py-3 mb-4 text-left"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block font-sans text-[13px] font-semibold text-ink-900">
                      Show who this is shared with
                    </span>
                    <span className="block font-sans text-[11.5px] text-text-secondary truncate">
                      {groups
                        .filter(g => visibleTo.includes(g.id))
                        .map(g => g.name)
                        .join(', ')}{' '}
                      appears on the card
                    </span>
                  </span>
                  <span
                    className={`shrink-0 w-11 h-6 rounded-full relative transition-colors ${
                      showGroups ? 'bg-green-700' : 'bg-grey-300'
                    }`}
                  >
                    <span
                      className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white transition-all ${
                        showGroups ? 'left-[23px]' : 'left-[3px]'
                      }`}
                    />
                  </span>
                </button>
              )}

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
            </div>
          </Step>

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

/**
 * A gated step in the create form.
 *
 * The point is what it does NOT do: unmount. R2 shipped these as `{show && …}`
 * with a `rise` keyframe, so unlocking a step inserted a block of layout and
 * shoved everything below it — including the sheet's own edges — at the same
 * moment the animation was trying to be pretty about it. That reflow was the
 * jarring part, not the duration.
 *
 * A locked step keeps its space and is only made invisible and inert, so
 * unlocking animates opacity, a 16px lift and a small defocus, and moves
 * nothing. That leaves the duration free to be a taste decision: 560ms, twice
 * R2's 280ms. Slow enough to read as the form opening up, still under the
 * threshold where a fast typer would be waiting on it.
 *
 * `aria-hidden` + `inert`-by-pointer-events keeps a locked step off the tab
 * order, since it is now in the DOM whether you have reached it or not.
 */
function Step({
  shown,
  stagger,
  children,
}: {
  shown: boolean
  /** A whisper behind the step above it, so the two do not arrive as one slab. */
  stagger?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      aria-hidden={!shown}
      className={`transition-[opacity,transform,filter] duration-[560ms] ease-[cubic-bezier(.22,.9,.3,1)] ${
        shown
          ? `opacity-100 translate-y-0 blur-0 ${stagger ? 'delay-[80ms]' : ''}`
          : 'opacity-0 translate-y-4 blur-[3px] pointer-events-none'
      }`}
    >
      {children}
    </div>
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
