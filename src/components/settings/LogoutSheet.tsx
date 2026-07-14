'use client'

// Screen 10: Log out confirmation sheet.
// Centered pill buttons (min-width 200px) per locked UI decisions.

import Sheet from '@/components/ui/Sheet'

interface LogoutSheetProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function LogoutSheet({ open, onConfirm, onCancel }: LogoutSheetProps) {
  return (
    <Sheet open={open} onClose={onCancel} className="px-5 pb-9">
      <h2 className="font-display font-bold text-[18px] text-text-primary tracking-tight mb-2">
        Log out?
      </h2>
      <p className="font-sans text-[14px] text-text-secondary leading-relaxed mb-6">
        You&apos;ll need to verify your number again to get back in.
      </p>
      <div className="flex justify-center mb-2">
        <button
          onClick={onConfirm}
          className="min-w-[200px] py-3.5 px-12 rounded-full bg-mooves-purple text-white font-sans font-semibold text-[15px]"
        >
          Log out
        </button>
      </div>
      <div className="flex justify-center">
        <button
          onClick={onCancel}
          className="min-w-[200px] py-3.5 px-12 rounded-full bg-surface-bg text-text-secondary font-sans font-semibold text-[15px]"
        >
          Cancel
        </button>
      </div>
    </Sheet>
  )
}
