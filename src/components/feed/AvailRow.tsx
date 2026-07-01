'use client'

// Amendment A: "Not now / Go free" avail-row — implementation pending

interface AvailRowProps {
  isAvailable: boolean
  onToggle: () => void
}

export default function AvailRow({ isAvailable, onToggle }: AvailRowProps) {
  return (
    <button
      onClick={onToggle}
      className="w-full text-left font-sans"
      aria-label={isAvailable ? "I'm free — tap to go grey" : 'Not now — tap to go free'}
    >
      {isAvailable ? "I'm free" : 'Not now'}
    </button>
  )
}
