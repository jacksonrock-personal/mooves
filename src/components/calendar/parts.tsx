'use client'

// R35 — the small pieces every calendar sheet shares: icons, the app tiles,
// the grouped-row geometry (Settings' card shape), and a body portal.
//
// The portal matters more than it looks. "Add to calendar" opens from inside a
// feed card, and a `position: fixed` sheet rendered there would be trapped by
// any transformed or filtered ancestor, and the card does not control what it
// is nested in. Rendering into <body> keeps every calendar sheet a true
// full-screen layer, stacked above whatever sheet opened it.

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function BodyPortal({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  useEffect(() => setTarget(document.body), [])
  return target ? createPortal(children, target) : null
}

export function CalendarIcon({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="4.5" width="18" height="16.5" rx="3" />
      <line x1="3" y1="9.5" x2="21" y2="9.5" />
      <line x1="8" y1="2.5" x2="8" y2="6.5" />
      <line x1="16" y1="2.5" x2="16" y2="6.5" />
      <line x1="12" y1="13" x2="12" y2="18" />
      <line x1="9.5" y1="15.5" x2="14.5" y2="15.5" />
    </svg>
  )
}

export function Chevron() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#BDB5D4"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

export function CheckIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function ExternalIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

export function InfoIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 mt-px text-purple-700"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

function LinkGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-purple-700"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

/**
 * The little calendar-page tile on each row. Apple's carries the weekday on a
 * red band, Google's the month on a purple one; both show the day number. They
 * are drawn, never the vendors' logos.
 */
export function AppTile({ kind, date }: { kind: 'apple' | 'google' | 'link'; date?: Date }) {
  if (kind === 'link') {
    return (
      <span className="w-9 h-9 shrink-0 rounded-[10px] bg-purple-100 border border-purple-100 flex items-center justify-center">
        <LinkGlyph />
      </span>
    )
  }
  const d = date ?? new Date()
  const band =
    kind === 'apple'
      ? d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
      : d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  return (
    <span className="w-9 h-9 shrink-0 rounded-[10px] bg-white border border-[#E8E4F5] overflow-hidden flex flex-col items-center">
      <span
        className={`w-full h-[11px] flex items-center justify-center font-sans text-[6.5px] font-extrabold tracking-[0.06em] text-white ${
          kind === 'apple' ? 'bg-red-500' : 'bg-purple-500'
        }`}
      >
        {band}
      </span>
      <span className="font-display font-extrabold text-[15px] leading-[22px] text-ink-900">
        {d.getDate()}
      </span>
    </span>
  )
}

/** Settings' grouped card, used for the rows inside every calendar sheet. */
export function RowGroup({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`mx-4 rounded-[20px] border border-[#E8E4F5] bg-white overflow-hidden divide-y divide-[#E8E4F5] ${className}`}
    >
      {children}
    </div>
  )
}

export function AppRow({
  tile,
  title,
  subtitle,
  onClick,
  disabled = false,
  chevron = true,
}: {
  tile: ReactNode
  title: string
  subtitle: string
  onClick: () => void
  disabled?: boolean
  chevron?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left disabled:opacity-50"
    >
      {tile}
      <span className="flex-1 min-w-0">
        <span className="block font-sans text-[15px] font-bold text-ink-900">{title}</span>
        <span className="block font-sans text-[12.5px] leading-[1.4] text-ink-500 mt-0.5">{subtitle}</span>
      </span>
      {chevron && <Chevron />}
    </button>
  )
}

/** Sheet title row: title on the left, an optional Done on the right. */
export function SheetTitle({ children, onDone }: { children: ReactNode; onDone?: () => void }) {
  return (
    <div className="flex items-center px-5">
      <h2 className="flex-1 font-display font-extrabold text-[18px] tracking-tight text-ink-900">{children}</h2>
      {onDone && (
        <button onClick={onDone} className="font-sans text-[14px] font-semibold text-ink-500">
          Done
        </button>
      )}
    </div>
  )
}

/** The URL as people read it: no scheme. */
export function displayUrl(url: string): string {
  return url.replace(/^[a-z]+:\/\//i, '')
}

/** Copy to the clipboard; false when the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
