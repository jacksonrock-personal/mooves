'use client'

// Phase 13.1 — multi-select over the fixed curated interest set. Reused in the
// Discover setup and in Settings.

import { INTERESTS } from '@/lib/interests'

interface InterestPickerProps {
  selected: string[]
  onChange: (slugs: string[]) => void
}

export default function InterestPicker({ selected, onChange }: InterestPickerProps) {
  function toggle(slug: string) {
    onChange(selected.includes(slug) ? selected.filter(s => s !== slug) : [...selected, slug])
  }

  return (
    <div className="flex flex-wrap gap-2">
      {INTERESTS.map(i => {
        const on = selected.includes(i.slug)
        return (
          <button
            key={i.slug}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(i.slug)}
            className={`font-sans text-[13px] font-semibold px-3.5 py-2 rounded-full border-[1.5px] transition-colors ${
              on ? 'bg-purple-500 border-purple-500 text-white' : 'bg-white border-[#E8E4F5] text-ink-500'
            }`}
          >
            {i.label}
          </button>
        )
      })}
    </div>
  )
}
