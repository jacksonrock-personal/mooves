'use client'

interface StatusDotProps {
  green: boolean
  size?: number
  className?: string
}

export default function StatusDot({ green, size = 10, className = '' }: StatusDotProps) {
  return (
    <span
      className={`rounded-full inline-block ${green ? 'bg-green-500' : 'bg-gray-300'} ${className}`}
      style={{ width: size, height: size }}
      aria-label={green ? 'Available' : 'Not available'}
    />
  )
}
