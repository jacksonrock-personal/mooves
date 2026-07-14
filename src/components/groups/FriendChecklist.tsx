'use client'

// Screen 9: searchable checklist of friends for the group create/edit form.
// Tapping a row toggles membership. Sorted alphabetically.

import { useMemo, useState } from 'react'
import Avatar from '@/components/ui/Avatar'

interface Friend {
  id: string
  displayName: string | null
  avatarUrl?: string | null
}

interface FriendChecklistProps {
  friends: Friend[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export default function FriendChecklist({ friends, selected, onChange }: FriendChecklistProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...friends].sort((a, b) =>
      (a.displayName ?? '').localeCompare(b.displayName ?? '', undefined, { sensitivity: 'base' })
    )
    if (!q) return sorted
    return sorted.filter(f => (f.displayName ?? '').toLowerCase().includes(q))
  }, [friends, query])

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])
  }

  return (
    <div>
      {/* Search */}
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

      {/* Checklist */}
      <ul>
        {filtered.map(f => {
          const checked = selected.includes(f.id)
          return (
            <li key={f.id}>
              <button
                onClick={() => toggle(f.id)}
                className="w-full flex items-center gap-[13px] px-5 py-2.5 border-t border-[#E8E4F5] text-left bg-card-white"
              >
                <Avatar src={f.avatarUrl} name={f.displayName} size={36} className="shrink-0" />
                <span className="flex-1 min-w-0 font-sans text-[15px] font-medium text-text-primary truncate">
                  {f.displayName}
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
        })}
      </ul>
    </div>
  )
}
