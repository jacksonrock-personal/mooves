'use client'

// Screen 9: Groups list — implementation pending

interface Group {
  id: string
  name: string
  emoji: string
  memberCount: number
}

interface GroupsListProps {
  groups: Group[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export default function GroupsList({ groups, onEdit, onDelete }: GroupsListProps) {
  return (
    <ul className="font-sans">
      {groups.map(g => (
        <li key={g.id} className="py-3 border-b border-gray-100 flex items-center gap-3">
          <span className="text-2xl">{g.emoji}</span>
          <div className="flex-1">
            <p className="font-semibold">{g.name}</p>
            <p className="text-sm text-text-secondary">{g.memberCount} friends</p>
          </div>
          <button onClick={() => onEdit(g.id)} className="text-sm text-mooves-purple">Edit</button>
          <button onClick={() => onDelete(g.id)} className="text-sm text-red-500">Delete</button>
        </li>
      ))}
    </ul>
  )
}
