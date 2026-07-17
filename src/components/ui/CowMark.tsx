// Transparent cow brand mark for in-app headers — the app-icon geometry
// (matches CowIllustration / public/brand/cow-icon.svg) with the cream
// background tile removed, so the cow sits beside the wordmark on any header.
// Light headers show it on white; the gradient Feed header shows it on purple.

interface CowMarkProps {
  size?: number
  className?: string
}

export default function CowMark({ size = 36, className = '' }: CowMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Mooves"
    >
      <ellipse cx="11" cy="33" rx="8" ry="17" fill="#ECE8F2" transform="rotate(-28 11 33)" />
      <ellipse cx="109" cy="33" rx="8" ry="17" fill="#ECE8F2" transform="rotate(28 109 33)" />
      <ellipse cx="11" cy="34" rx="4.5" ry="10" fill="#EAA8BB" transform="rotate(-28 11 34)" />
      <ellipse cx="109" cy="34" rx="4.5" ry="10" fill="#EAA8BB" transform="rotate(28 109 34)" />
      <ellipse cx="38" cy="19" rx="6" ry="13" fill="#CEAD6A" transform="rotate(-14 38 19)" />
      <ellipse cx="82" cy="19" rx="6" ry="13" fill="#CEAD6A" transform="rotate(14 82 19)" />
      <rect x="15" y="20" width="90" height="92" rx="30" fill="#F5F0ED" />
      <ellipse cx="41" cy="44" rx="19" ry="13" fill="#7A7282" transform="rotate(-10 41 44)" />
      <ellipse cx="79" cy="69" rx="14" ry="9" fill="#7A7282" transform="rotate(16 79 69)" />
      <circle cx="44" cy="57" r="6" fill="#2A1E38" />
      <circle cx="76" cy="57" r="6" fill="#2A1E38" />
      <circle cx="46.5" cy="54.5" r="2.2" fill="white" />
      <circle cx="78.5" cy="54.5" r="2.2" fill="white" />
      <ellipse cx="60" cy="90" rx="27" ry="20" fill="#F0AABB" />
      <circle cx="50" cy="91" r="9" fill="#2ECC71" />
      <circle cx="70" cy="91" r="9" fill="#BDB5D4" />
    </svg>
  )
}
