'use client'

interface GroupRowProps {
  id: string
  name: string
  emoji: string
  memberCount: number
  onTap: (id: string) => void
}

export default function GroupRow({ id, name, emoji, memberCount, onTap }: GroupRowProps) {
  return (
    <button
      onClick={() => onTap(id)}
      className="w-full flex items-center gap-3 py-3 border-b border-gray-100 text-left"
    >
      <div className="w-[42px] h-[42px] rounded-xl bg-purple-50 flex items-center justify-center text-xl shrink-0">
        {emoji}
      </div>
      <div className="flex-1 font-sans">
        <p className="font-semibold">{name}</p>
        <p className="text-sm text-text-secondary">{memberCount} friends</p>
      </div>
      <span className="text-gray-400">›</span>
    </button>
  )
}
