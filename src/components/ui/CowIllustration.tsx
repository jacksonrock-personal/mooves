interface CowIllustrationProps {
  size?: number
  className?: string
}

export default function CowIllustration({ size = 80, className = '' }: CowIllustrationProps) {
  return (
    <span
      role="img"
      aria-label="Cow"
      className={`block text-center ${className}`}
      style={{ fontSize: size }}
    >
      🐄
    </span>
  )
}
