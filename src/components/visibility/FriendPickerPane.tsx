'use client'

// R16 — the friend picker, as a PANE of the sheet that opened it.
//
// It is not a bottom sheet. It was built as one first, and stacking it on top
// of the sheet that summoned it (three deep, on the green modal) was rejected
// at mockup. See PaneTrack for why sideways is the right axis.
//
// Two ways out, and they mean different things:
//   Done         — commits the draft to the caller.
//   back chevron — returns without committing, so a mis-tap costs nothing.
//
// The draft lives HERE, not in the caller, which is what makes "back" able to
// discard. The caller is handed a list exactly once, on Done.

import { useEffect, useMemo, useState } from 'react'
import Avatar from '@/components/ui/Avatar'
import { PaneBack } from '@/components/ui/PaneTrack'
import { friendCountLabel } from './VisibilityRow'

export interface PickableFriend {
  id: string
  displayName: string | null
  avatarUrl: string | null
}

interface FriendPickerPaneProps {
  friends: PickableFriend[]
  /** The committed selection, copied into the draft each time the pane opens. */
  selected: string[]
  /** True while this pane is the visible one — the cue to reset the draft. */
  active: boolean
  onCancel: () => void
  onDone: (ids: string[]) => void
}

export default function FriendPickerPane({
  friends,
  selected,
  active,
  onCancel,
  onDone,
}: FriendPickerPaneProps) {
  const [draft, setDraft] = useState<string[]>(selected)
  const [query, setQuery] = useState('')

  // Reopening shows what you picked last time, still checked — this is an edit,
  // not a restart. Resetting on `active` (rather than on mount) matters because
  // the pane stays mounted inside the track the whole time the sheet is open.
  useEffect(() => {
    if (active) {
      setDraft(selected)
      setQuery('')
    }
    // `selected` is intentionally not a dependency: re-syncing the draft while
    // the user is mid-edit would fight their taps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...friends].sort((a, b) =>
      (a.displayName ?? '').localeCompare(b.displayName ?? '', undefined, { sensitivity: 'base' }),
    )
    return q ? sorted.filter(f => (f.displayName ?? '').toLowerCase().includes(q)) : sorted
  }, [friends, query])

  function toggle(id: string) {
    setDraft(d => (d.includes(id) ? d.filter(x => x !== id) : [...d, id]))
  }

  return (
    <>
      <div className="shrink-0 px-5 pb-1">
        <PaneBack onBack={onCancel} label="Add specific friends" />
        <p className="font-sans text-[13.5px] text-ink-500 leading-relaxed mb-3.5">
          They will see it. They will not be told you picked them, and their names never show on the
          card.
        </p>
      </div>

      <div className="shrink-0 relative px-5 pb-2.5">
        <svg
          className="absolute left-[27px] top-1/2 -translate-y-[70%] text-ink-500 pointer-events-none"
          width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search friends"
          className={`w-full bg-purple-50 rounded-xl py-2.5 pl-8 pr-3 font-sans text-[14px] outline-none border-[1.5px] text-ink-900 ${
            query.trim() ? 'border-purple-500' : 'border-[#E8E4F5] placeholder:text-ink-500'
          }`}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {friends.length === 0 ? (
          <p className="px-5 py-7 text-center font-sans text-[13px] text-ink-500">
            Nobody to pick yet. Add some friends first.
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-7 text-center font-sans text-[13px] text-ink-500">
            Nobody by that name.
          </p>
        ) : (
          <ul>
            {filtered.map(f => {
              const checked = draft.includes(f.id)
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => toggle(f.id)}
                    aria-pressed={checked}
                    className="w-full flex items-center gap-[13px] px-5 py-2.5 border-t border-[#E8E4F5] text-left bg-card-white"
                  >
                    <Avatar src={f.avatarUrl} name={f.displayName} size={36} className="shrink-0" />
                    <span className="flex-1 min-w-0 font-sans text-[15px] font-medium text-ink-900 truncate">
                      {f.displayName ?? 'Friend'}
                    </span>
                    <span
                      className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center shrink-0 ${
                        checked ? 'bg-purple-500 border-purple-500' : 'border-[#E8E4F5]'
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
            })}
          </ul>
        )}
      </div>

      <div className="shrink-0 px-5 pt-3 border-t border-grey-100 [--safe-pb-base:1.375rem] safe-area-pb">
        <button
          type="button"
          onClick={() => onDone(draft)}
          className="w-full py-[15px] rounded-2xl bg-purple-500 text-white font-display font-extrabold text-[15.5px] tracking-tight shadow-[0_6px_18px_rgba(124,92,219,0.3)]"
        >
          {draft.length > 0 ? `Done, ${friendCountLabel(draft.length)}` : 'Done'}
        </button>
      </div>
    </>
  )
}
