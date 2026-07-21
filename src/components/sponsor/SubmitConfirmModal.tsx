'use client'

// Phase 16 #14 — save-time billing disclosure. When a sponsor submits a move for
// review, first confirm what happens with billing: if a card is on file, name it
// and the charge (on approval + go-live); if not, prompt to add one. The charge
// itself still only happens when an admin approves and the move goes live.

export interface SubmitBilling {
  hasCard: boolean
  placementPriceCents: number
  brand: string | null
  last4: string | null
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`
}

interface Props {
  billing: SubmitBilling
  onConfirm: () => void
  onAddCard: () => void
  onCancel: () => void
}

export default function SubmitConfirmModal({ billing, onConfirm, onAddCard, onCancel }: Props) {
  const price = dollars(billing.placementPriceCents)

  return (
    <div className="fixed inset-0 z-50 bg-ink-900/50 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="w-[430px] max-w-full bg-white rounded-[18px] p-6 shadow-[0_30px_70px_rgba(0,0,0,0.35)]"
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
      >
        {billing.hasCard ? (
          <>
            <div className="w-12 h-12 rounded-[13px] bg-green-100 flex items-center justify-center mb-3.5">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#167A43" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </div>
            <h3 className="font-display font-extrabold text-[19px] text-ink-900 tracking-[-0.01em]">Submit this move?</h3>
            <p className="text-[13.5px] text-ink-500 leading-relaxed mt-2">
              When Mooves approves it and it goes live, your card is charged the placement fee. You&apos;re not charged for anything under review or rejected.
            </p>
            <div className="flex items-center gap-3 border border-[#E8E4F5] rounded-[12px] p-3 my-4">
              <div className="w-[42px] h-[28px] rounded-[5px] bg-[#1A1F71] text-white font-extrabold italic text-[10px] flex items-center justify-center shrink-0">
                {(billing.brand ?? 'CARD').toUpperCase().slice(0, 4)}
              </div>
              <div className="text-[13.5px] font-bold text-ink-900 capitalize">
                {billing.brand} ending {billing.last4}
              </div>
              <div className="ml-auto text-[13.5px] font-bold text-purple-700">{price}</div>
            </div>
            <div className="flex gap-2.5">
              <button onClick={onConfirm} className="flex-1 bg-purple-500 text-white font-semibold text-[13.5px] rounded-[10px] px-4 py-2.5">
                Submit for review
              </button>
              <button onClick={onCancel} className="flex-1 bg-white border border-[#E8E4F5] text-ink-900 font-semibold text-[13.5px] rounded-[10px] px-4 py-2.5">
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-[13px] bg-purple-100 flex items-center justify-center mb-3.5">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7C5CDB" strokeWidth="2" strokeLinecap="round"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18M7 15h4" /></svg>
            </div>
            <h3 className="font-display font-extrabold text-[19px] text-ink-900 tracking-[-0.01em]">Add a payment method</h3>
            <p className="text-[13.5px] text-ink-500 leading-relaxed mt-2">
              You have no card on file. Your card is charged <b className="text-ink-900">{price}</b> only when Mooves approves this move and it goes live. Nothing is charged while it&apos;s under review.
            </p>
            <div className="bg-purple-50 border border-[#E8E4F5] rounded-[12px] px-3.5 py-3 text-[13px] text-ink-900 my-4">
              Placement fee <b className="text-purple-700">{price}</b> per move, charged on go-live.
            </div>
            <div className="flex gap-2.5">
              <button onClick={onAddCard} className="flex-1 bg-purple-500 text-white font-semibold text-[13.5px] rounded-[10px] px-4 py-2.5">
                Add a card
              </button>
              <button onClick={onConfirm} className="flex-1 bg-white border border-[#E8E4F5] text-ink-900 font-semibold text-[13.5px] rounded-[10px] px-4 py-2.5">
                Submit anyway
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
