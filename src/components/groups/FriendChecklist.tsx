'use client'

import { useState } from 'react'
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

  const filtered = query.trim()
    ? friends.filter(f => f.displayName?.toLowerCase().includes(query.toLowerCase()))
    : friends

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])
  }

  return (
    <div className="font-sans">
      <input
        type="text"
        placeholder="Search friends"
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm mb-2 outline-none focus:ring-2 focus:ring-mooves-purple"
      />
      <ul>
        {filtered.map(f => {
          const checked = selected.includes(f.id)
          return (
            <li key={f.id}>
              <button
                onClick={() => toggle(f.id)}
                className="w-full flex items-center gap-3 py-3 border-b border-gray-100 text-left"
              >
                <Avatar src={f.avatarUrl} name={f.displayName} size={36} />
                <span className="flex-1">{f.displayName}</span>
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  checked ? 'bg-mooves-purple border-mooves-purple' : 'border-gray-300'
                }`}>
                  {checked && <span className="text-white text-xs">✓</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
