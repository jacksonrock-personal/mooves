'use client'

import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  duration?: number
  onDismiss: () => void
}

export default function Toast({ message, duration = 3000, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 300)
    }, duration)
    return () => clearTimeout(t)
  }, [duration, onDismiss])

  return (
    <div
      className={`fixed bottom-24 left-4 right-4 z-50 transition-all duration-300 ${
        visible ? 'opacity-100' : 'opacity-0 scale-95'
      }`}
    >
      <div className="bg-card-white text-text-primary text-sm font-sans font-semibold rounded-2xl px-4 py-3.5 text-center shadow-[0_8px_24px_rgba(124,92,219,0.25)] border border-purple-tint animate-toast-pop">
        {message}
      </div>
    </div>
  )
}
