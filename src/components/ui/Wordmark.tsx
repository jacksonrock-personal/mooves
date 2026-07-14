// Mooves wordmark — the "M[oo]VES" lockup where the double-o is a green + grey
// status-dot pair. Dark variant for white-background screens (People, Settings),
// light variant for gradient headers (Feed). Matches mooves-prototype.html.

interface WordmarkProps {
  variant?: 'dark' | 'light'
}

export default function Wordmark({ variant = 'dark' }: WordmarkProps) {
  if (variant === 'light') {
    return (
      <span className="inline-flex items-center font-display font-extrabold text-[20px] text-white tracking-[-0.02em]">
        M
        <span className="inline-flex items-center gap-px relative top-[0.5px] mx-px">
          <span className="w-[11px] h-[11px] rounded-full bg-status-green shadow-[0_0_6px_rgba(46,204,113,0.6)]" />
          <span className="w-[11px] h-[11px] rounded-full bg-white/35" />
        </span>
        VES
      </span>
    )
  }

  return (
    <span className="inline-flex items-center font-display font-extrabold text-[16px] text-text-primary tracking-[-0.02em]">
      M
      <span className="inline-flex items-center gap-px relative top-[0.5px]">
        <span className="w-[9px] h-[9px] rounded-full bg-status-green" />
        <span className="w-[9px] h-[9px] rounded-full bg-status-grey mr-px" />
      </span>
      VES
    </span>
  )
}
