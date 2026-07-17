'use client'

// Phase 9.1 — coarse time chip on go-green. Single-select, skippable, no picker.

export type StatusTime = 'now' | 'tonight' | 'weekend'

const CHIPS: { value: StatusTime; label: string }[] = [
  { value: 'now', label: 'Now' },
  { value: 'tonight', label: 'Tonight' },
  { value: 'weekend', label: 'This weekend' },
]

export function timeLabel(value: string | null | undefined): string | null {
  switch (value) {
    case 'now': return 'Now'
    case 'tonight': return 'Tonight'
    case 'weekend': return 'This weekend'
    default: return null
  }
}

interface TimeChipsProps {
  selected: StatusTime | null
  onChange: (value: StatusTime | null) => void
}

export default function TimeChips({ selected, onChange }: TimeChipsProps) {
  return (
    <div className="flex gap-2">
      {CHIPS.map(chip => {
        const active = selected === chip.value
        return (
          <button
            key={chip.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? null : chip.value)}
            className={`flex-1 min-h-12 flex items-center justify-center text-center rounded-xl px-2 py-1.5 font-sans text-[14px] font-semibold leading-tight transition-colors ${
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
