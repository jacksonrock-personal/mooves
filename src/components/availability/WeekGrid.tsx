'use client'

// Phase 22 — the Morning/Day/Evening week grid, on its own.
//
// Extracted from WeekRitualSheet (R38) so onboarding's "Set the rest of your
// week?" row renders the SAME grid rather than a redrawing of it: same cells,
// same past-slot rules, same purple-not-green selection. The sheet and the
// onboarding row own loading and saving; this only draws and toggles.

import {
  SLOT_LABEL,
  isDayPast,
  isSlotPast,
  slotColumns,
  toLocalDateStr,
  type SlotPart,
} from '@/lib/availability'

/** `${YYYY-MM-DD}:${part}` */
export type SlotKey = string

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface WeekGridProps {
  days: Date[]
  selected: Set<SlotKey>
  onToggle: (dateStr: string, part: SlotPart) => void
  disabled?: boolean
}

export default function WeekGrid({ days, selected, onToggle, disabled = false }: WeekGridProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {days.map(day => {
        const dateStr = toLocalDateStr(day)
        const weekday = day.getDay()
        const isWeekend = weekday === 0 || weekday === 6
        const dayDone = isDayPast(day)
        return (
          <div key={dateStr} className={`flex items-center gap-1.5 ${dayDone ? 'opacity-30' : ''}`}>
            <span className="w-[42px] shrink-0">
              <span
                className={`block font-sans text-[12.5px] font-bold leading-tight ${
                  isWeekend ? 'text-purple-700' : 'text-ink-900'
                }`}
              >
                {DAY_NAMES[weekday]}
              </span>
              <span className="block font-sans text-[10px] font-semibold leading-tight text-grey-300">
                {day.getDate()}
              </span>
            </span>

            {/* Always three columns. R26 — all three are now real controls
                on every row; the null branch below is kept because
                slotColumns still types a hole, and a grid that cannot
                render one is a grid that breaks the day a rule comes back. */}
            {slotColumns(weekday).map((part, i) => {
              if (!part) return <span key={i} className="h-[38px] flex-1" aria-hidden="true" />
              const key = `${dateStr}:${part}`
              const on = selected.has(key)
              const spent = isSlotPast(day, part)
              return (
                <button
                  key={i}
                  type="button"
                  disabled={spent || disabled}
                  aria-pressed={on}
                  onClick={() => onToggle(dateStr, part)}
                  className={`h-[38px] flex-1 rounded-xl border-[1.5px] font-sans text-[11.5px] transition-colors disabled:cursor-default ${
                    on
                      // Purple, never green. Green in this app means free
                      // NOW and visible to friends; a set slot is neither.
                      ? 'border-purple-500 bg-purple-100 font-bold text-purple-700'
                      : 'border-[#E8E4F5] bg-white font-semibold text-ink-500'
                  }`}
                >
                  {SLOT_LABEL[part]}
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
