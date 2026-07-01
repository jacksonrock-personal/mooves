'use client'

// Screen 4 — Amendment A: "Not now / Go free" avail-row (not-free state)
// and full-width "I'm free" button (free state) — overrides original locked-UI toggle.
// Only the "Go free" pill itself is tappable — the row around it is inert.

interface AvailRowProps {
  isAvailable: boolean
  onToggle: () => void
}

export default function AvailRow({ isAvailable, onToggle }: AvailRowProps) {
  if (isAvailable) {
    return (
      <button
        onClick={onToggle}
        className="w-full py-[14px] px-5 rounded-2xl bg-status-green text-white font-display font-extrabold text-[16px] tracking-tight animate-glow-pulse mb-5"
        aria-label="I'm free — tap to go grey"
      >
        I&apos;m free
      </button>
    )
  }

  return (
    <div className="w-full flex items-center justify-between py-[14px] px-5 rounded-2xl bg-card-white border-[1.5px] border-[#E8E4F5] mb-5">
      <span className="flex items-center gap-2">
        <span className="w-[9px] h-[9px] rounded-full bg-status-grey" />
        <span className="font-display font-bold text-[15px] text-text-primary">Not now</span>
      </span>
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 rounded-full bg-status-green px-3.5 py-1.5"
        aria-label="Go free"
      >
        <span className="w-2 h-2 rounded-full bg-white animate-pulse-dot" />
        <span className="font-sans font-semibold text-[13px] text-white">Go free</span>
      </button>
    </div>
  )
}
