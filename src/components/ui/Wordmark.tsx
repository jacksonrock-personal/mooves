// Mooves wordmark — the "M[oo]VES" lockup where the double-o is a green + grey
// status-dot pair. Dark variant for white-background screens (People, Settings),
// light variant for gradient headers (Feed). Matches mooves-prototype.html.
//
// `withCow` renders the Phase 8 brand lockup: the transparent cow mark beside an
// enlarged wordmark, for the in-app headers (Feed, People, Settings, Auth).

import CowMark from './CowMark'

interface WordmarkProps {
  variant?: 'dark' | 'light'
  withCow?: boolean
}

export default function Wordmark({ variant = 'dark', withCow = false }: WordmarkProps) {
  const wordmark =
    variant === 'light' ? (
      <span
        className={`inline-flex items-center font-display font-extrabold text-white tracking-[-0.02em] ${
          withCow ? 'text-[24px]' : 'text-[20px]'
        }`}
      >
        M
        <span className="inline-flex items-center gap-px relative top-[0.5px] mx-px">
          <span
            className={`rounded-full bg-green-500 shadow-[0_0_6px_rgba(46,204,113,0.6)] ${
              withCow ? 'w-[13px] h-[13px]' : 'w-[11px] h-[11px]'
            }`}
          />
          <span className={`rounded-full bg-white/35 ${withCow ? 'w-[13px] h-[13px]' : 'w-[11px] h-[11px]'}`} />
        </span>
        VES
      </span>
    ) : (
      <span
        className={`inline-flex items-center font-display font-extrabold text-ink-900 tracking-[-0.02em] ${
          withCow ? 'text-[22px]' : 'text-[16px]'
        }`}
      >
        M
        <span className="inline-flex items-center gap-px relative top-[0.5px]">
          <span className={`rounded-full bg-green-500 ${withCow ? 'w-[12px] h-[12px]' : 'w-[9px] h-[9px]'}`} />
          <span className={`rounded-full bg-grey-300 mr-px ${withCow ? 'w-[12px] h-[12px]' : 'w-[9px] h-[9px]'}`} />
        </span>
        VES
      </span>
    )

  if (!withCow) return wordmark

  return (
    <span className="inline-flex items-center gap-[9px]">
      <CowMark size={36} className="shrink-0" />
      {wordmark}
    </span>
  )
}
