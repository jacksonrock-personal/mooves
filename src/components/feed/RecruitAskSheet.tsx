'use client'

// Phase 24.3 — the one recruit ask.
//
// It fires the first time a user goes green THEMSELVES, which is the same
// motivated moment as the cold-start reveal: they have just made something, and
// its reach is bounded by the people they have. One concept, two placements.
//
// "6 people can see that" is the entire mechanism. It is a status about their
// own reach, and a number begs to be bigger in a way "invite your friends" never
// will. No urgency, no manufactured scarcity, no exclamation point.
//
// ONCE, EVER. After dismissal nothing persists — no demoted banner, no affordance
// in the empty state. That was designed, reviewed and cut: the line between a
// good nudge and a muted app is almost entirely repetition, and Add friends is
// already one tap away in People for anyone who wants it.

import Sheet from '@/components/ui/Sheet'
import { posthog } from '@/lib/posthog'

interface RecruitAskSheetProps {
  open: boolean
  /** How many people can see this green right now. The whole point. */
  reach: number
  /** When the green runs to, e.g. "Thursday". Null falls back to a plain line. */
  timeLabel: string | null
  /** True when they arrived via a group link — reorders the first answer. */
  cameFromGroup: boolean
  onClose: () => void
  onPath: (path: 'group' | 'room' | 'person') => void
}

const ROOM = {
  key: 'room' as const,
  title: 'People in the room',
  sub: 'One code, everyone scans.',
  icon: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <path d="M14 17.5h7M17.5 14v7" />
    </>
  ),
}
const GROUP = {
  key: 'group' as const,
  title: 'Got another group chat?',
  sub: 'Name it, drop the link in that chat.',
  icon: <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-4-.9L3 21l1.9-4.9A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4Z" />,
}
const PERSON = {
  key: 'person' as const,
  title: 'Just one person',
  sub: 'Your personal link.',
  icon: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
}

export default function RecruitAskSheet({
  open,
  reach,
  timeLabel,
  cameFromGroup,
  onClose,
  onPath,
}: RecruitAskSheetProps) {
  // Someone who arrived through a group link has just experienced that flywheel
  // from the receiving end, so it converts best when it leads.
  const rows = cameFromGroup ? [GROUP, ROOM, PERSON] : [ROOM, GROUP, PERSON]

  return (
    <Sheet open={open} onClose={onClose} className="px-5 pb-6">
      <h2 className="font-display font-extrabold text-[20px] text-ink-900 tracking-[-0.02em] leading-[1.2]">
        {timeLabel ? `You're free ${timeLabel.toLowerCase()}.` : "You're free."}
        <br />
        {reach === 0
          ? 'Nobody can see that.'
          : `${reach} ${reach === 1 ? 'person' : 'people'} can see that.`}
      </h2>
      <p className="font-sans text-[13.5px] text-ink-500 mt-1.5">Who else should?</p>

      <div className="mt-[18px]">
        {rows.map(row => (
          <button
            key={row.key}
            onClick={() => {
              posthog.capture('recruit_ask_path', { path: row.key })
              onPath(row.key)
            }}
            className="w-full flex items-start gap-3 bg-white border-[1.5px] border-[#E8E4F5] rounded-[15px] px-3.5 py-3 text-left mb-2"
          >
            <span className="shrink-0 w-[34px] h-[34px] rounded-[11px] bg-purple-100 flex items-center justify-center text-purple-700">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {row.icon}
              </svg>
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-display font-extrabold text-[14px] text-ink-900 tracking-tight">
                {row.title}
              </span>
              <span className="block font-sans text-[11.5px] text-ink-500 leading-[1.4] mt-px">
                {row.sub}
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* "Not now" rather than "No thanks", because it is accurate: it never
          asks again. */}
      <button
        onClick={onClose}
        className="block w-full text-center mt-3 font-sans text-[13.5px] font-medium text-ink-500"
      >
        Not now
      </button>
    </Sheet>
  )
}
