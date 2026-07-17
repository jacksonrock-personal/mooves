'use client'

// Screen 9: Edit Group (full-screen push)
// Mockup: mooves-screen9-groups.html

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { posthog } from '@/lib/posthog'
import GroupForm from '@/components/groups/GroupForm'
import InviteLinkSheet from '@/components/groups/InviteLinkSheet'
import Sheet from '@/components/ui/Sheet'

interface Friend {
  id: string
  displayName: string | null
  avatarUrl: string | null
}

interface Group {
  id: string
  name: string
  emoji: string
  memberIds: string[]
}

export default function EditGroupPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const groupId = params.id

  const [friends, setFriends] = useState<Friend[]>([])
  const [group, setGroup] = useState<Group | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [friendsRes, groupsRes] = await Promise.all([
        fetch('/api/friends').then(r => r.json()) as Promise<{ friends: Friend[] }>,
        fetch('/api/groups').then(r => r.json()) as Promise<{ groups: Group[] }>,
      ])
      if (cancelled) return

      const match = (groupsRes.groups ?? []).find(g => g.id === groupId)
      if (!match) {
        router.replace('/people')
        return
      }
      setFriends(friendsRes.friends ?? [])
      setGroup(match)
      setLoaded(true)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [groupId, router])

  async function handleSave(name: string, emoji: string, memberIds: string[]) {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, emoji, memberIds }),
      })
      if (!res.ok) throw new Error('save failed')
      posthog.capture('group_edit_saved')
      router.push('/people')
    } catch {
      setError("Couldn't save, try again.")
      setSaving(false)
    }
  }

  async function handleConfirmDelete() {
    setDeleteOpen(false)
    posthog.capture('group_delete_confirmed')
    try {
      const res = await fetch(`/api/groups/${groupId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      router.push('/people')
    } catch {
      setError("Couldn't delete, try again.")
    }
  }

  if (!loaded || !group) {
    return (
      <main className="min-h-screen bg-surface-bg flex items-center justify-center">
        <p className="font-sans text-[14px] text-text-secondary">Loading…</p>
      </main>
    )
  }

  return (
    <>
      <GroupForm
        title={group.name}
        initialName={group.name}
        initialEmoji={group.emoji}
        initialMemberIds={group.memberIds}
        friends={friends}
        saving={saving}
        error={error}
        onSave={handleSave}
        onBack={() => router.push('/people')}
        onShareInvite={() => {
          posthog.capture('group_invite_opened')
          setInviteOpen(true)
        }}
        onDelete={() => {
          posthog.capture('group_delete_initiated')
          setDeleteOpen(true)
        }}
      />

      <InviteLinkSheet
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        groupId={groupId}
        groupName={group.name}
        groupEmoji={group.emoji}
        memberCount={group.memberIds.length + 1}
      />

      <Sheet open={deleteOpen} onClose={() => setDeleteOpen(false)} className="px-5 pb-8">
        <h2 className="font-display font-bold text-[18px] text-text-primary tracking-tight mb-2">
          Delete {group.name}?
        </h2>
        <p className="font-sans text-[14px] text-text-secondary leading-relaxed mb-6">
          Your friends won&apos;t be affected, this just removes the group.
        </p>
        <button
          onClick={() => void handleConfirmDelete()}
          className="w-full py-3.5 rounded-2xl bg-[#FFF0F2] text-[#E8405A] font-sans font-semibold text-[15px] mb-2"
        >
          Delete
        </button>
        <button
          onClick={() => {
            posthog.capture('group_delete_cancelled')
            setDeleteOpen(false)
          }}
          className="w-full py-3.5 rounded-2xl bg-surface-bg text-text-secondary font-sans font-semibold text-[15px]"
        >
          Cancel
        </button>
      </Sheet>
    </>
  )
}
