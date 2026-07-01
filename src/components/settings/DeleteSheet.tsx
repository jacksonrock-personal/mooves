'use client'

import { useState } from 'react'

// Screen 10: Type-to-confirm DELETE sheet — implementation pending

interface DeleteSheetProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function DeleteSheet({ open, onConfirm, onCancel }: DeleteSheetProps) {
  const [input, setInput] = useState('')

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="w-full bg-white rounded-t-2xl p-6 font-sans">
        <p className="font-semibold text-lg">Delete your account?</p>
        <p className="text-sm text-text-secondary mt-1">
          This permanently removes your profile, friendships, and groups. Type DELETE to confirm.
        </p>
        <input
          type="text"
          placeholder="Type DELETE"
          value={input}
          onChange={e => setInput(e.target.value)}
          className="mt-4 w-full border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-red-400"
        />
        <button
          onClick={onConfirm}
          disabled={input !== 'DELETE'}
          className="mt-4 w-full bg-red-500 disabled:opacity-40 text-white rounded-full py-3 font-semibold"
        >
          Delete account
        </button>
        <button onClick={onCancel} className="mt-3 w-full text-text-secondary py-2">
          Cancel
        </button>
      </div>
    </div>
  )
}
