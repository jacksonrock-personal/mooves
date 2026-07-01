'use client'

// Bottom sheet with curated 21-emoji grid — implementation pending (Phase 1 Screen 9)

const EMOJIS = ['🤝','👥','⭐','🎓','💼','🏠','🏋️','🎉','🍕','🎮','🎸','✈️','🏄','🌙','🔥','💯','🐶','🌿','☕','🎨','📍']

interface EmojiPickerProps {
  open: boolean
  selected: string
  onSelect: (emoji: string) => void
  onClose: () => void
}

export default function EmojiPicker({ open, selected, onSelect, onClose }: EmojiPickerProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="w-full bg-white rounded-t-2xl p-6">
        <p className="font-sans font-semibold mb-4">Pick an emoji</p>
        <div className="grid grid-cols-7 gap-3">
          {EMOJIS.map(e => (
            <button
              key={e}
              onClick={() => { onSelect(e); onClose() }}
              className={`text-2xl rounded-lg p-2 ${selected === e ? 'bg-purple-100 ring-2 ring-mooves-purple' : ''}`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
