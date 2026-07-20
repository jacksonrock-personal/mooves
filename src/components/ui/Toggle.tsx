'use client'

// DS switch. 44px-tall hit area (a11y) around a 46×28 track.

interface ToggleProps {
  on: boolean
  onChange: (on: boolean) => void
  disabled?: boolean
  label?: string
}

export default function Toggle({ on, onChange, disabled = false, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`shrink-0 h-11 flex items-center ${disabled ? 'opacity-50' : ''}`}
    >
      <span
        className={`relative w-[46px] h-[28px] rounded-full transition-colors ${on ? 'bg-purple-500' : 'bg-grey-300'}`}
      >
        <span
          className={`absolute top-[3px] left-[3px] w-[22px] h-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(28,23,48,0.3)] transition-transform ${
            on ? 'translate-x-[18px]' : ''
          }`}
        />
      </span>
    </button>
  )
}
