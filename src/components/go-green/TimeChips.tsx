'use client'

// Phase 9.1 — coarse time chip on go-green. Single-select, skippable, no picker.
// Phase 18.1 — adds 'week' ("This week"), offered Mon–Thu only.
// Phase 24.5 — adds 'tomorrow'. "This week" and "Now" both SURVIVE; the only
// suppression is "Now" during the onboarding rehearsal (hideNow), where a green
// that dies in four hours teaches the wrong lesson on day one.

import {
  isWeekChipAvailable,
  STATUS_TIMES,
  STATUS_TIME_LABEL,
  statusTimeLabel,
  type StatusTime,
} from '@/lib/greenExpiry'

export type { StatusTime }
/** @deprecated import statusTimeLabel from '@/lib/greenExpiry' instead. */
export const timeLabel = statusTimeLabel

const CHIPS: { value: StatusTime; label: string }[] = STATUS_TIMES.map(value => ({
  value,
  label: STATUS_TIME_LABEL[value],
}))

interface TimeChipsProps {
  selected: StatusTime | null
  onChange: (value: StatusTime | null) => void
  /** 24.5 — onboarding only. Everywhere else "Now" is offered as it always was. */
  hideNow?: boolean
}

export default function TimeChips({ selected, onChange, hideNow = false }: TimeChipsProps) {
  // 18.1 — Fri–Sun drops "This week" and falls back to the original three.
  // Evaluated at render on the viewer's local clock, same basis as the expiry.
  let chips = isWeekChipAvailable() ? CHIPS : CHIPS.filter(c => c.value !== 'week')
  if (hideNow) chips = chips.filter(c => c.value !== 'now')

  return (
    // Four chips do not fit on one row at 320px, so the row wraps and each chip
    // takes a minimum share rather than a rigid flex-1.
    <div className="flex flex-wrap gap-2">
      {chips.map(chip => {
        const active = selected === chip.value
        return (
          <button
            key={chip.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? null : chip.value)}
            className={`flex-1 basis-[calc(50%-0.25rem)] min-h-12 flex items-center justify-center text-center rounded-xl px-2 py-1.5 font-sans text-[14px] font-semibold leading-tight transition-colors ${
              active ? 'bg-purple-500 text-white' : 'bg-purple-100 text-purple-700'
            }`}
          >
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}
