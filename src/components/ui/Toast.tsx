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
      className={`fixed bottom-24 left-4 right-4 z-50 transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="bg-gray-900 text-white text-sm font-sans rounded-xl px-4 py-3 text-center shadow-lg">
        {message}
      </div>
    </div>
  )
}
