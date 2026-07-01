'use client'

// Screen 5: Go Grey action sheet — native iOS-style confirmation

interface GoGreyConfirmProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function GoGreyConfirm({ open, onConfirm, onCancel }: GoGreyConfirmProps) {
  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-text-primary/50 z-40"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div className="fixed bottom-0 left-0 right-0 z-50 px-2 pb-11 flex flex-col gap-2 safe-area-pb">
        <div className="rounded-2xl overflow-hidden border border-[#E8E4F5] bg-surface-bg/95 backdrop-blur-xl">
          <p className="font-sans text-[12px] font-medium text-text-secondary text-center px-4 pt-3 pb-1.5 border-b border-[#E8E4F5]">
            You&apos;re going dark and won&apos;t be visible
          </p>
          <button
            onClick={onConfirm}
            className="w-full py-4 font-sans text-[17px] font-semibold text-[#E8405A]"
          >
            Go grey
          </button>
        </div>
        <button
          onClick={onCancel}
          className="w-full py-4 rounded-2xl border border-[#E8E4F5] bg-surface-bg/95 backdrop-blur-xl font-sans text-[17px] font-bold text-text-primary"
        >
          Cancel
        </button>
      </div>
    </>
  )
}
