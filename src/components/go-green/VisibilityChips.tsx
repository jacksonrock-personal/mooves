'use client'

// Amendment B: horizontally scrollable chip row for group selector

interface Group {
  id: string
  name: string
  emoji: string
}

interface VisibilityChipsProps {
  groups: Group[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export default function VisibilityChips({ groups, selected, onChange }: VisibilityChipsProps) {
  const allSelected = selected.length === 0

  const toggleGroup = (id: string) => {
    if (selected.includes(id)) {
      const next = selected.filter(s => s !== id)
      onChange(next)
    } else {
      onChange([...selected, id])
    }
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 font-sans">
      <button
        onClick={() => onChange([])}
        className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold border ${
          allSelected
            ? 'bg-mooves-purple text-white border-mooves-purple'
            : 'bg-white text-text-secondary border-gray-200'
        }`}
      >
        All friends
      </button>
      {groups.map(g => {
        const active = selected.includes(g.id)
        return (
          <button
            key={g.id}
            onClick={() => toggleGroup(g.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold border ${
              active
                ? 'bg-mooves-purple text-white border-mooves-purple'
                : 'bg-white text-text-secondary border-gray-200'
            }`}
          >
            {g.emoji} {g.name}
          </button>
        )
      })}
    </div>
  )
}
