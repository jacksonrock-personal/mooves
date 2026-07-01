'use client'

// Screen 5: Go Grey action sheet — implementation pending

interface GoGreyConfirmProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function GoGreyConfirm({ open, onConfirm, onCancel }: GoGreyConfirmProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="w-full bg-white rounded-t-2xl p-6">
        <p className="font-sans font-semibold">You&apos;re going dark and won&apos;t be visible</p>
        <button onClick={onConfirm} className="mt-4 text-red-500 font-sans">Go grey</button>
        <button onClick={onCancel} className="mt-2 font-sans text-text-secondary">Cancel</button>
      </div>
    </div>
  )
}
