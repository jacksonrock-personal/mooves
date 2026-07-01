'use client'

// Screen 5: Go Green Sheet — implementation pending

interface GoGreenSheetProps {
  open: boolean
  onClose: () => void
  onConfirm: (note: string | null, visibleTo: string[] | null) => void
}

export default function GoGreenSheet({ open, onClose, onConfirm }: GoGreenSheetProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="w-full bg-white rounded-t-2xl p-6">
        <p className="font-sans text-text-secondary">Go Green Sheet — coming soon</p>
        <button onClick={() => onConfirm(null, null)} className="mt-4 font-sans">
          Continue
        </button>
        <button onClick={onClose} className="mt-2 font-sans text-text-secondary">
          Cancel
        </button>
      </div>
    </div>
  )
}
