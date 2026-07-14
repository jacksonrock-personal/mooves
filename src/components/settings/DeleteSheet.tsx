'use client'

// Screen 10: Type-to-confirm DELETE sheet. The destructive button stays
// disabled until the input exactly equals "DELETE" (case-sensitive).

import { useEffect, useState } from 'react'
import Sheet from '@/components/ui/Sheet'

interface DeleteSheetProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function DeleteSheet({ open, onConfirm, onCancel }: DeleteSheetProps) {
  const [input, setInput] = useState('')

  // Reset the field each time the sheet opens.
  useEffect(() => {
    if (open) setInput('')
  }, [open])

  const confirmed = input === 'DELETE'

  return (
    <Sheet open={open} onClose={onCancel} className="px-5 pb-9">
      <h2 className="font-display font-bold text-[18px] text-text-primary tracking-tight mb-2">
        Delete your account?
      </h2>
      <p className="font-sans text-[14px] text-text-secondary leading-[1.55] mb-5">
        This permanently removes your profile, friendships, and groups. Type DELETE to confirm.
      </p>
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="Type DELETE"
        autoComplete="off"
        autoCapitalize="characters"
        className={`w-full rounded-xl border-[1.5px] px-4 py-3 mb-5 font-sans text-[15px] tracking-[0.04em] outline-none ${
          confirmed
            ? 'border-[#E8405A] bg-[#FFF8F8] text-text-primary font-semibold'
            : 'border-[#E8E4F5] bg-surface-bg text-text-primary placeholder:text-text-secondary'
        }`}
      />
      <div className="flex justify-center mb-2">
        <button
          onClick={onConfirm}
          disabled={!confirmed}
          className="min-w-[200px] py-3.5 px-12 rounded-full font-sans font-semibold text-[15px] bg-[#E8405A] text-white disabled:bg-[#E8E4F5] disabled:text-text-secondary"
        >
          Delete account
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
