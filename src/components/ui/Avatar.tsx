'use client'

interface AvatarProps {
  src?: string | null
  name?: string | null
  size?: number
  className?: string
}

export default function Avatar({ src, name, size = 44, className = '' }: AvatarProps) {
  const initials = name
    ? name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  if (src) {
    return (
      <img
        src={src}
        alt={name ?? 'Avatar'}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className={`rounded-full bg-mooves-purple flex items-center justify-center text-white font-bold font-sans ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-label={name ?? 'Avatar'}
    >
      {initials}
    </div>
  )
}
