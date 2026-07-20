'use client'

// Phase 13 surface 2 — reject a move with a reason the sponsor receives.

import { useEffect, useState } from 'react'

interface RejectModalProps {
  open: boolean
  moveTitle: string
  submitting: boolean
  onReject: (reason: string) => void
  onCancel: () => void
}

export default function RejectModal({ open, moveTitle, submitting, onReject, onCancel }: RejectModalProps) {
  const [reason, setReason] = useState('')
  useEffect(() => {
    if (open) setReason('')
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink-900/50" onClick={onCancel} aria-hidden="true" />
      <div className="relative bg-white rounded-2xl p-6 w-[420px] max-w-[90%] shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
        <h3 className="font-display font-extrabold text-[18px] text-ink-900 mb-1">Reject this move?</h3>
        <p className="text-[13px] text-ink-500 mb-4 leading-relaxed">
          The sponsor gets this reason so they can fix and resubmit. Be specific and kind.
        </p>
        <div className="text-[12px] font-semibold text-ink-500 mb-1.5">{moveTitle}</div>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          autoFocus
          placeholder="e.g. The link doesn't resolve, and the title reads like an ad. Add a real venue and a working URL."
          className="w-full border-[1.5px] border-[#E8E4F5] rounded-[10px] px-3 py-2.5 text-[14px] text-ink-900 outline-none focus:border-purple-500 resize-none leading-relaxed"
        />
        <div className="flex gap-2.5 mt-4">
          <button onClick={onCancel} className="bg-white border border-[#E8E4F5] text-ink-900 font-semibold text-[13.5px] rounded-[10px] px-4 py-2.5">
            Cancel
          </button>
          <button
            disabled={!reason.trim() || submitting}
            onClick={() => onReject(reason.trim())}
            className="flex-1 bg-red-500 text-white font-semibold text-[13.5px] rounded-[10px] px-4 py-2.5 disabled:opacity-40"
          >
            {submitting ? 'Sending…' : 'Send rejection'}
          </button>
        </div>
      </div>
    </div>
  )
}
