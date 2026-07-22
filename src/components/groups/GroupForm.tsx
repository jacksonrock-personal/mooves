'use client'

// Screen 9: shared create/edit group form (full-screen push).
// Emoji + name row, searchable friend checklist, and a Done button that stays
// disabled until the group has a name and at least one member.

import { useState } from 'react'
import EmojiPicker from './EmojiPicker'
import FriendChecklist from './FriendChecklist'
import MemberEditor from './MemberEditor'

interface Friend {
  id: string
  displayName: string | null
  avatarUrl?: string | null
}

interface GroupFormProps {
  title: string
  initialName?: string
  initialEmoji?: string
  initialMemberIds?: string[]
  friends: Friend[]
  saving: boolean
  error: string | null
  onSave: (name: string, emoji: string, memberIds: string[]) => void
  onBack: () => void
  onDelete?: () => void
  onShareInvite?: () => void
}

export default function GroupForm({
  title,
  initialName = '',
  initialEmoji = '👥',
  initialMemberIds = [],
  friends,
  saving,
  error,
  onSave,
  onBack,
  onDelete,
  onShareInvite,
}: GroupFormProps) {
  const [name, setName] = useState(initialName)
  const [emoji, setEmoji] = useState(initialEmoji)
  const [selected, setSelected] = useState<string[]>(initialMemberIds)
  const [pickerOpen, setPickerOpen] = useState(false)

  const hasFriends = friends.length > 0
  // Members are optional (Phase 10) — a group can start empty and grow via its invite link.
  const canSave = name.trim().length > 0 && !saving
  const isCreate = !onShareInvite

  return (
    <div className="min-h-screen flex flex-col bg-surface-bg">
      {/* Header */}
      <header className="bg-card-white border-b border-[#E8E4F5] pt-14 pb-3 px-4 flex items-center justify-between shrink-0">
        <button
          onClick={onBack}
          className="min-w-[56px] flex items-center gap-1 font-sans text-[15px] font-medium text-mooves-purple"
        >
          <svg width="9" height="15" viewBox="0 0 9 15" fill="none">
            <path d="M8 1L1.5 7.5L8 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <h1 className="flex-1 text-center font-display font-bold text-[16px] text-text-primary tracking-tight truncate px-2">
          {title}
        </h1>
        {isCreate ? (
          // #3 — create uses the prominent bottom button, not a corner action.
          <div className="min-w-[56px]" aria-hidden="true" />
        ) : (
          <button
            onClick={() => canSave && onSave(name.trim(), emoji, selected)}
            disabled={!canSave}
            className={`min-w-[56px] text-right font-sans text-[15px] font-semibold ${
              canSave ? 'text-mooves-purple' : 'text-status-grey'
            }`}
          >
            {saving ? 'Saving…' : 'Done'}
          </button>
        )}
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Emoji + name row */}
        <div className="bg-card-white mt-4 px-5 py-4 flex items-center gap-3.5 border-y border-[#E8E4F5]">
          <button
            onClick={() => setPickerOpen(true)}
            className="relative w-[50px] h-[50px] rounded-2xl bg-purple-tint flex items-center justify-center text-[28px] leading-none shrink-0"
            aria-label="Choose emoji"
          >
            {emoji}
            <span className="absolute -bottom-1 -right-1 w-[18px] h-[18px] rounded-full bg-mooves-purple border-2 border-card-white flex items-center justify-center">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </span>
          </button>
          <div className="flex-1 min-w-0">
            <label
              htmlFor="group-name"
              className="block font-sans text-[11px] font-semibold text-text-secondary uppercase tracking-[0.08em] mb-1"
            >
              Group name
            </label>
            <input
              id="group-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value.slice(0, 40))}
              maxLength={40}
              placeholder="e.g. College friends"
              autoCapitalize="words"
              className="w-full font-sans text-[16px] font-medium text-text-primary placeholder:text-text-secondary placeholder:font-normal bg-transparent outline-none"
            />
          </div>
        </div>

        {/* Friends section. Edit mode gets the frictioned MemberEditor (Screen 9
            amendment): members only until "Edit group", removal always confirms.
            Create mode keeps the open checklist — picking people is the point there. */}
        {hasFriends ? (
          !isCreate ? (
            <MemberEditor
              friends={friends}
              initialMemberIds={initialMemberIds}
              selected={selected}
              onChange={setSelected}
              groupName={name}
            />
          ) : (
            <div className="bg-card-white mt-2 border-t border-[#E8E4F5]">
              <div className="flex items-center justify-between px-5 pt-3 pb-2">
                <span className="font-sans text-[11px] font-semibold text-text-secondary uppercase tracking-[0.08em]">
                  Add friends (optional)
                </span>
                {selected.length > 0 && (
                  <span className="font-sans text-[12px] font-semibold text-mooves-purple">
                    {selected.length} selected
                  </span>
                )}
              </div>
              <FriendChecklist friends={friends} selected={selected} onChange={setSelected} />
            </div>
          )
        ) : (
          <p className="font-sans text-[14px] text-text-secondary leading-relaxed px-6 py-7 text-center">
            No friends to add yet. Name your group, then share its invite link to fill it up.
          </p>
        )}

        {/* Inline reason the button is disabled */}
        {!canSave && !saving && (
          <p className="font-sans text-[12px] text-text-secondary px-5 pt-3">
            Add a group name to finish.
          </p>
        )}

        {error && (
          <p className="font-sans text-[13px] text-[#E8405A] px-5 pt-4">{error}</p>
        )}

        {/* Invite link (edit mode only) */}
        {onShareInvite && (
          <button
            onClick={onShareInvite}
            className="mx-5 mt-5 w-[calc(100%-40px)] py-3.5 rounded-2xl bg-purple-100 text-purple-700 font-sans font-semibold text-[15px] flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Invite link
          </button>
        )}

        {/* Delete (edit mode only) */}
        {onDelete && (
          <button
            onClick={onDelete}
            className="mx-5 mt-5 mb-2 w-[calc(100%-40px)] py-3.5 rounded-2xl bg-[#FFF0F2] text-[#E8405A] font-sans font-semibold text-[15px]"
          >
            Delete group
          </button>
        )}

        {/* #3 — prominent create action (create mode only), pinned to the bottom.
            Replaces the easy-to-miss corner "Done" as the primary create step. */}
        {isCreate && (
          <div className="mt-auto px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            <button
              onClick={() => canSave && onSave(name.trim(), emoji, selected)}
              disabled={!canSave}
              className="w-full py-4 rounded-2xl bg-mooves-purple text-white font-display font-extrabold text-[16px] tracking-tight shadow-[0_6px_18px_rgba(124,92,219,0.32)] disabled:opacity-40 disabled:shadow-none"
            >
              {saving ? 'Creating…' : 'Create group'}
            </button>
            <p className="font-sans text-[11.5px] text-text-secondary text-center mt-2.5 leading-snug">
              You&apos;ll get an invite link to share right after.
            </p>
          </div>
        )}
      </div>

      <EmojiPicker
        open={pickerOpen}
        selected={emoji}
        onSelect={setEmoji}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  )
}
