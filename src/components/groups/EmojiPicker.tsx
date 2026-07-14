'use client'

// Screen 9: emoji picker — bottom sheet with a curated 21-emoji grid.
// Selection is immediate (no save button); tapping an emoji closes the sheet.

import Sheet from '@/components/ui/Sheet'

const EMOJIS = [
  '🤝', '👥', '⭐', '🎓', '💼', '🏠', '🏋️',
  '🎉', '🍕', '🎮', '🎸', '✈️', '🏄', '🌙',
  '🔥', '💯', '🐶', '🌿', '☕', '🎨', '📍',
]

interface EmojiPickerProps {
  open: boolean
  selected: string
  onSelect: (emoji: string) => void
  onClose: () => void
}

export default function EmojiPicker({ open, selected, onSelect, onClose }: EmojiPickerProps) {
  return (
    <Sheet open={open} onClose={onClose} className="px-5 pb-8">
      <p className="font-display font-bold text-[16px] text-text-primary text-center mb-4">
        Pick an emoji
      </p>
      <div className="grid grid-cols-7 gap-1">
        {EMOJIS.map(e => (
          <button
            key={e}
            onClick={() => {
              onSelect(e)
              onClose()
            }}
            className={`aspect-square flex items-center justify-center text-[26px] leading-none rounded-[10px] ${
              selected === e ? 'bg-purple-tint outline outline-2 outline-mooves-purple' : ''
            }`}
          >
            {e}
          </button>
        ))}
      </div>
    </Sheet>
  )
}
