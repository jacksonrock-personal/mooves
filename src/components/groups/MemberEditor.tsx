'use client'

// Screen 9 amendment — group EDIT member friction. Members-only by default;
// the full friend list appears only after an explicit "Edit group" tap
// (search on top → members pre-checked → "Everyone else" → the rest).
// Unchecking a current member always goes through a confirm sheet; re-checking
// (undo) and adding new people never do. Nothing writes until Done saves the
// batch, same as before. Mockup: mooves-screen9-group-edit-friction.html.

import { useMemo, useState } from 'react'
import Avatar from '@/components/ui/Avatar'
import Sheet from '@/components/ui/Sheet'
import { posthog } from '@/lib/posthog'

interface Friend {
  id: string
  displayName: string | null
  avatarUrl?: string | null
}

interface MemberEditorProps {
  friends: Friend[]
  // Membership at open time — these stay pinned in the Members section even
  // while unchecked, so a removal can be undone with a tap until save.
  initialMemberIds: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  groupName: string
}

function byName(a: Friend, b: Friend): number {
  return (a.displayName ?? '').localeCompare(b.displayName ?? '', undefined, { sensitivity: 'base' })
}

export default function MemberEditor({
  friends,
  initialMemberIds,
  selected,
  onChange,
  groupName,
}: MemberEditorProps) {
  const [expanded, setExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const [confirming, setConfirming] = useState<Friend | null>(null)

  const pinnedIds = useMemo(() => new Set(initialMemberIds), [initialMemberIds])

  const { members, others } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const match = (f: Friend) => !q || (f.displayName ?? '').toLowerCase().includes(q)
    const sorted = [...friends].sort(byName)
    return {
      members: sorted.filter(f => pinnedIds.has(f.id) && match(f)),
      others: sorted.filter(f => !pinnedIds.has(f.id) && match(f)),
    }
  }, [friends, pinnedIds, query])

  function tapRow(friend: Friend) {
    const checked = selected.includes(friend.id)
    if (checked && pinnedIds.has(friend.id)) {
      // Removal intent on a current member — always confirm.
      setConfirming(friend)
      return
    }
    // Add, un-add, or re-check undo — no confirm.
    onChange(checked ? selected.filter(id => id !== friend.id) : [...selected, friend.id])
  }

  function confirmRemove() {
    if (confirming) {
      onChange(selected.filter(id => id !== confirming.id))
      posthog.capture('group_member_remove_confirmed')
    }
    setConfirming(null)
  }

  function keepMember() {
    posthog.capture('group_member_remove_kept')
    setConfirming(null)
  }

  const firstName = confirming?.displayName?.split(' ')[0] ?? 'them'

  function renderRow(friend: Friend) {
    const checked = selected.includes(friend.id)
    return (
      <li key={friend.id}>
        <button
          onClick={() => tapRow(friend)}
          className={`w-full flex items-center gap-[13px] px-5 py-2.5 border-t border-[#E8E4F5] text-left bg-card-white ${
            pinnedIds.has(friend.id) && !checked ? 'opacity-55' : ''
          }`}
        >
          <Avatar src={friend.avatarUrl} name={friend.displayName} size={36} className="shrink-0" />
          <span className="flex-1 min-w-0 font-sans text-[15px] font-medium text-text-primary truncate">
            {friend.displayName}
          </span>
          <span
            className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center shrink-0 ${
              checked ? 'bg-mooves-purple border-mooves-purple' : 'border-[#E8E4F5]'
            }`}
          >
            {checked && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </span>
        </button>
      </li>
    )
  }

  return (
    <div className="bg-card-white mt-2 border-t border-[#E8E4F5]">
      <div className="flex items-center justify-between px-5 pt-3 pb-2">
        <span className="font-sans text-[11px] font-semibold text-text-secondary uppercase tracking-[0.08em]">
          Members
        </span>
        <span className="font-sans text-[12px] font-semibold text-mooves-purple">
          {selected.length} {selected.length === 1 ? 'member' : 'members'}
        </span>
      </div>

      {/* Search — only while expanded, always on top of the list */}
      {expanded && (
        <div className="relative px-4 pb-2.5">
          <svg
            className="absolute left-[27px] top-1/2 -translate-y-[60%] text-text-secondary pointer-events-none"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search friends"
            className={`w-full bg-surface-bg rounded-[10px] py-2 pl-8 pr-3 font-sans text-[13px] outline-none border-[1.5px] ${
              query.trim()
                ? 'border-mooves-purple text-text-primary'
                : 'border-[#E8E4F5] text-text-primary placeholder:text-text-secondary'
            }`}
          />
        </div>
      )}

      {/* Current members (pinned — removed ones stay here unchecked until save) */}
      {initialMemberIds.length === 0 ? (
        <p className="font-sans text-[13.5px] text-text-secondary leading-relaxed px-5 pt-3.5 pb-0.5 border-t border-[#E8E4F5]">
          No members yet, share the invite link to fill it up.
        </p>
      ) : (
        <ul>{members.map(renderRow)}</ul>
      )}

      {/* Everyone else — only while expanded */}
      {expanded && others.length > 0 && (
        <>
          <p className="font-sans text-[10px] font-bold text-status-grey uppercase tracking-[0.08em] px-5 pt-2.5 pb-1 border-t border-[#E8E4F5]">
            Everyone else
          </p>
          <ul>{others.map(renderRow)}</ul>
        </>
      )}

      <button
        onClick={() => {
          setExpanded(v => !v)
          setQuery('')
        }}
        className={`mx-5 mt-3 mb-3.5 w-[calc(100%-40px)] py-3.5 rounded-2xl font-sans font-semibold text-[15px] ${
          expanded ? 'bg-purple-tint text-purple-700' : 'bg-mooves-purple text-white'
        }`}
      >
        {expanded ? 'Done editing' : 'Edit group'}
      </button>

      {/* Removal confirm — the one piece of friction that always applies */}
      <Sheet open={confirming !== null} onClose={keepMember} className="px-5 pb-8">
        <div className="text-center">
          <h2 className="font-display font-extrabold text-[19px] text-ink-900 tracking-tight mb-1.5">
            Remove {firstName} from {groupName.trim() || 'this group'}?
          </h2>
          <p className="font-sans text-[13.5px] text-ink-500 leading-relaxed mb-5">
            They lose the group and its greens.
          </p>
        </div>
        <button
          onClick={confirmRemove}
          className="w-full py-3.5 rounded-2xl bg-[#FFF0F2] text-[#E8405A] font-sans font-bold text-[15px]"
        >
          Remove
        </button>
        <button
          onClick={keepMember}
          className="w-full py-3.5 mt-2 rounded-2xl bg-purple-50 text-ink-500 font-sans font-semibold text-[15px]"
        >
          Keep in group
        </button>
      </Sheet>
    </div>
  )
}
