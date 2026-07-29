'use client'

// R16 — "Who can see this?", shared by the Moove composer, the Go Green sheet
// and the green modal, because three copies of a visibility rule is three
// chances to disagree about who can see something.
//
// THE MODEL, in one line: an audience is the UNION of the picked groups and the
// picked individuals, and "Everyone" is the absence of both.
//
// What this component deliberately will not do: name an individual anywhere on
// a card. 18.2's "show who this is shared with" label stays gated on GROUPS
// only. Pick only individuals and the toggle does not appear at all, because
// there would be nothing it could honestly say.

interface Group {
  id: string
  name: string
  emoji: string | null
}

interface VisibilityRowProps {
  groups: Group[]
  selectedGroupIds: string[]
  selectedUserIds: string[]
  showGroups: boolean
  onGroupsChange: (ids: string[]) => void
  onUserIdsChange: (ids: string[]) => void
  onShowGroupsChange: (on: boolean) => void
  /** Opens the friend picker pane. This row never owns that pane's state. */
  onPickFriends: () => void
}

export function friendCountLabel(n: number): string {
  return `${n} ${n === 1 ? 'friend' : 'friends'}`
}

export default function VisibilityRow({
  groups,
  selectedGroupIds,
  selectedUserIds,
  showGroups,
  onGroupsChange,
  onUserIdsChange,
  onShowGroupsChange,
  onPickFriends,
}: VisibilityRowProps) {
  const everyone = selectedGroupIds.length === 0 && selectedUserIds.length === 0
  const hasFriends = selectedUserIds.length > 0

  function toggleGroup(id: string) {
    const next = selectedGroupIds.includes(id)
      ? selectedGroupIds.filter(g => g !== id)
      : [...selectedGroupIds, id]
    onGroupsChange(next)
    // 18.2 — the label only exists in the context of a group scope. Dropping
    // back to no groups takes the toggle away, so don't leave it armed.
    if (next.length === 0) onShowGroupsChange(false)
  }

  function selectEveryone() {
    // "Everyone" is the absence of BOTH kinds of narrowing, so it clears both.
    // Clearing only the groups here would leave a Moove that still reaches a
    // handful of named people while its chip claimed it reached everybody.
    onGroupsChange([])
    onUserIdsChange([])
    onShowGroupsChange(false)
  }

  return (
    <>
      <div className="flex gap-2 flex-wrap mb-4">
        <Chip on={everyone} onClick={selectEveryone}>
          Everyone
        </Chip>

        {/* The only chip that opens something rather than toggling, which is why
            it is the only one carrying a chevron. */}
        <Chip on={hasFriends} onClick={onPickFriends}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            {!hasFriends && <path d="M19 8v6M22 11h-6" />}
          </svg>
          {hasFriends ? friendCountLabel(selectedUserIds.length) : 'Add specific friends'}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-60">
            <polyline points="9 5 16 12 9 19" />
          </svg>
        </Chip>

        {groups.map(g => (
          <Chip key={g.id} on={selectedGroupIds.includes(g.id)} onClick={() => toggleGroup(g.id)}>
            {g.emoji ? `${g.emoji} ` : ''}
            {g.name}
          </Chip>
        ))}
      </div>

      {/* 18.2 — groups only, never individuals. The sub-line says so out loud
          once both kinds are picked, because that is the moment somebody would
          otherwise wonder whether the names leak. */}
      {selectedGroupIds.length > 0 && (
        <button
          type="button"
          role="switch"
          aria-checked={showGroups}
          onClick={() => onShowGroupsChange(!showGroups)}
          className="w-full flex items-start gap-3 text-left rounded-2xl border-[1.5px] border-[#E8E4F5] bg-purple-50 px-3.5 py-3 mb-4"
        >
          <span className="flex-1 min-w-0">
            <span className="block font-sans text-[13px] font-semibold text-ink-900 leading-snug">
              Show who this is shared with
            </span>
            <span className="block font-sans text-[11.5px] text-ink-500 leading-snug mt-0.5">
              {showGroups
                ? `${groups
                    .filter(g => selectedGroupIds.includes(g.id))
                    .map(g => g.name)
                    .join(', ')} appears on the card.${
                    hasFriends ? ' Friends you picked by name never do.' : ''
                  }`
                : 'Off, nobody sees which groups you picked.'}
            </span>
          </span>
          <span
            aria-hidden="true"
            className={`shrink-0 mt-0.5 w-11 h-6 rounded-full relative transition-colors ${
              showGroups ? 'bg-green-700' : 'bg-grey-300'
            }`}
          >
            <span
              className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-all ${
                showGroups ? 'left-[23px]' : 'left-[3px]'
              }`}
            />
          </span>
        </button>
      )}
    </>
  )
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full font-sans text-[12.5px] font-semibold border-[1.5px] ${
        on
          ? 'bg-purple-100 border-purple-500 text-purple-700'
          : 'bg-card-white border-[#E8E4F5] text-text-secondary'
      }`}
    >
      {children}
    </button>
  )
}
