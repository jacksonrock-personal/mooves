'use client'

// Screen 10: Log out confirmation sheet — implementation pending

interface LogoutSheetProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function LogoutSheet({ open, onConfirm, onCancel }: LogoutSheetProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="w-full bg-white rounded-t-2xl p-6 font-sans">
        <p className="font-semibold text-lg">Log out?</p>
        <p className="text-sm text-text-secondary mt-1">
          You&apos;ll need to verify your number again to get back in.
        </p>
        <button onClick={onConfirm} className="mt-6 w-full bg-mooves-purple text-white rounded-full py-3 font-semibold">
          Log out
        </button>
        <button onClick={onCancel} className="mt-3 w-full text-text-secondary py-2">
          Cancel
        </button>
      </div>
    </div>
  )
}
