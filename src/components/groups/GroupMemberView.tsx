'use client'

// Read-only view of a group you're a MEMBER of but don't own (joined via an
// invite link, Phase 10). Shows the group + everyone in it; you can leave.
// Editing / renaming / member management / the invite link stay owner-only.

import Avatar from '@/components/ui/Avatar'

export interface RosterMember {
  id: string
  displayName: string | null
  avatarUrl: string | null
  isOwner: boolean
  isYou: boolean
}

interface GroupMemberViewProps {
  name: string
  emoji: string
  members: RosterMember[]
  leaving: boolean
  onBack: () => void
  onLeave: () => void
}

export default function GroupMemberView({
  name,
  emoji,
  members,
  leaving,
  onBack,
  onLeave,
}: GroupMemberViewProps) {
  return (
    <div className="min-h-screen flex flex-col bg-purple-50">
      <header className="bg-white border-b border-[#E8E4F5] pt-14 pb-3 px-4 flex items-center justify-between shrink-0">
        <button
          onClick={onBack}
          className="min-w-[56px] flex items-center gap-1 font-sans text-[15px] font-medium text-purple-500"
        >
          <svg width="9" height="15" viewBox="0 0 9 15" fill="none">
            <path d="M8 1L1.5 7.5L8 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <h1 className="flex-1 text-center font-display font-bold text-[16px] text-ink-900 tracking-tight truncate px-2">
          {name}
        </h1>
        <div className="min-w-[56px]" />
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Emoji + name */}
        <div className="bg-white mt-4 px-5 py-5 flex items-center gap-3.5 border-y border-[#E8E4F5]">
          <div className="w-[50px] h-[50px] rounded-2xl bg-purple-100 flex items-center justify-center text-[28px] leading-none shrink-0">
            {emoji}
          </div>
          <div className="min-w-0">
            <p className="font-display font-bold text-[17px] text-ink-900 truncate">{name}</p>
            <p className="font-sans text-[13px] text-ink-500 mt-0.5">
              {members.length} {members.length === 1 ? 'person' : 'people'}
            </p>
          </div>
        </div>

        {/* Members */}
        <div className="bg-white mt-2 border-t border-[#E8E4F5]">
          <p className="font-sans text-[11px] font-semibold text-ink-500 uppercase tracking-[0.08em] px-5 pt-3 pb-1">
            In this group
          </p>
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3 px-5 py-2.5 border-t border-[#E8E4F5]">
              <Avatar src={m.avatarUrl} name={m.displayName ?? '?'} size={40} className="shrink-0" />
              <span className="flex-1 font-sans text-[15px] font-medium text-ink-900 truncate">
                {m.isYou ? 'You' : (m.displayName ?? 'Friend')}
              </span>
              {m.isOwner && (
                <span className="shrink-0 font-sans text-[11px] font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                  Owner
                </span>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={onLeave}
          disabled={leaving}
          className="mx-5 mt-5 mb-2 w-[calc(100%-40px)] py-3.5 rounded-2xl bg-red-tint text-red-500 font-sans font-semibold text-[15px] disabled:opacity-60"
        >
          {leaving ? 'Leaving…' : 'Leave group'}
        </button>
      </div>
    </div>
  )
}
