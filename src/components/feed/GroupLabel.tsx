// 18.2 — the group visibility label. Names the groups a green was shared with.
//
// On a friend's card the list arrives already intersected with the viewer's own
// memberships (get_feed does that), so this component renders whatever it is
// given and never filters. On the mover's own card it is the full selection.
//
// Names are never truncated: the pill wraps to as many lines as it needs and the
// card grows to fit. Hence the 13px radius rather than a full capsule, which
// looks broken once the text runs to two lines.

interface GroupLabelProps {
  groups: string[]
}

export default function GroupLabel({ groups }: GroupLabelProps) {
  if (groups.length === 0) return null

  return (
    <span className="inline-flex items-start gap-1.5 max-w-full min-w-0 rounded-[13px] border border-[#E8E4F5] bg-white pl-[7px] pr-2.5 py-[3px]">
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 mt-[3px] text-grey-300"
        aria-hidden="true"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      </svg>
      <span className="font-sans text-[11px] font-semibold text-ink-500 leading-[1.4] break-words min-w-0">
        {groups.join(', ')}
      </span>
    </span>
  )
}
