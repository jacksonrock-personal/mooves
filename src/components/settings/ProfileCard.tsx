'use client'

// Screen 10: Profile section — 80px avatar with camera badge, inline-editable
// name (auto-saves on blur), read-only phone. Mockup: mooves-screen10-settings.html

import { useEffect, useRef, useState } from 'react'

interface ProfileCardProps {
  displayName: string | null
  phone: string
  avatarUrl?: string | null
  onNameSave: (name: string) => void
  onAvatarTap: () => void
}

// E.164 (+15551234567) → +1 (555) 123-4567
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (national.length !== 10) return phone
  return `+1 (${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`
}

function initialsOf(name: string | null): string {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function ProfileCard({
  displayName,
  phone,
  avatarUrl,
  onNameSave,
  onAvatarTap,
}: ProfileCardProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(displayName ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep the draft in sync when the saved name changes from outside.
  useEffect(() => {
    if (!editing) setDraft(displayName ?? '')
  }, [displayName, editing])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function commit() {
    setEditing(false)
    const trimmed = draft.trim()
    // Empty or unchanged → revert silently, no save.
    if (!trimmed || trimmed === (displayName ?? '')) {
      setDraft(displayName ?? '')
      return
    }
    onNameSave(trimmed)
  }

  return (
    <div className="bg-card-white mt-4 px-5 pt-7 pb-6 flex flex-col items-center border-y border-[#E8E4F5]">
      {/* Avatar */}
      <button
        onClick={onAvatarTap}
        className="relative w-20 h-20 mb-3.5"
        aria-label="Change profile photo"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={displayName ?? 'Your photo'}
            className="w-20 h-20 rounded-full object-cover"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-mooves-purple to-[#9B7FE8] flex items-center justify-center font-display font-bold text-[26px] text-white">
            {initialsOf(displayName)}
          </div>
        )}
        <span className="absolute bottom-px right-px w-[26px] h-[26px] rounded-full bg-card-white border-2 border-surface-bg flex items-center justify-center shadow-[0_1px_4px_rgba(0,0,0,0.12)]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7C5CDB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </span>
      </button>

      {/* Name — tap to edit, auto-saves on blur */}
      {editing ? (
        <div className="mb-1.5 text-center">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value.slice(0, 30))}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === 'Enter') inputRef.current?.blur()
            }}
            maxLength={30}
            autoCapitalize="words"
            className="w-[180px] text-center font-display font-bold text-[20px] text-text-primary tracking-tight border-0 border-b-2 border-mooves-purple bg-transparent outline-none px-2 pt-0.5 pb-1"
          />
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 mb-1.5"
        >
          <span className="font-display font-bold text-[20px] text-text-primary tracking-tight">
            {displayName ?? 'Add your name'}
          </span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6B628A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      )}

      {/* Phone — read-only */}
      <div className="flex items-center gap-1.5 font-sans text-[14px] text-text-secondary">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        {formatPhone(phone)}
      </div>
    </div>
  )
}
