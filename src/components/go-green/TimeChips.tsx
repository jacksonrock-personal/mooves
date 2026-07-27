'use client'

// Phase 9.1 — coarse time chip on go-green. Single-select, skippable, no picker.
// Phase 18.1 — adds 'week' ("This week"), offered Mon–Thu only.

import { isWeekChipAvailable } from '@/lib/greenExpiry'

export type StatusTime = 'now' | 'tonight' | 'week' | 'weekend'

const CHIPS: { value: StatusTime; label: string }[] = [
  { value: 'now', label: 'Now' },
  { value: 'tonight', label: 'Tonight' },
  { value: 'week', label: 'This week' },
  { value: 'weekend', label: 'This weekend' },
]

export function timeLabel(value: string | null | undefined): string | null {
  switch (value) {
    case 'now': return 'Now'
    case 'tonight': return 'Tonight'
    case 'week': return 'This week'
    case 'weekend': return 'This weekend'
    default: return null
  }
}

interface TimeChipsProps {
  selected: StatusTime | null
  onChange: (value: StatusTime | null) => void
}

export default function TimeChips({ selected, onChange }: TimeChipsProps) {
  // 18.1 — Fri–Sun drops "This week" and falls back to the original three.
  // Evaluated at render on the viewer's local clock, same basis as the expiry.
  const chips = isWeekChipAvailable() ? CHIPS : CHIPS.filter(c => c.value !== 'week')

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
