'use client'

// Screen 9: Group detail (full-screen push).
// Owner → editable GroupForm (+ invite link + delete). Member (joined via link,
// Phase 10) → read-only GroupMemberView (see the group + roster, leave).

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { posthog } from '@/lib/posthog'
import GroupForm from '@/components/groups/GroupForm'
import GroupMemberView from '@/components/groups/GroupMemberView'
import type { RosterMember } from '@/components/groups/RosterRow'
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
  ownerId: string
  isOwner: boolean
  memberIds: string[]
}

export default function GroupDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const groupId = params.id

  const [friends, setFriends] = useState<Friend[]>([])
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<RosterMember[]>([])
  const [addingId, setAddingId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      // The roster comes from the group itself, not from your friends list —
      // co-members you aren't friends with used to render as "Friend" + "?".
      const [friendsRes, groupRes] = await Promise.all([
        fetch('/api/friends').then(r => r.json()) as Promise<{ friends: Friend[] }>,
        fetch(`/api/groups/${groupId}`).then(r => (r.ok ? r.json() : null)) as Promise<
          { group: Group; members: RosterMember[] } | null
        >,
      ])
      if (cancelled) return

      if (!groupRes) {
        router.replace('/people')
        return
      }
      const match = groupRes.group
      setFriends(friendsRes.friends ?? [])
      setGroup(match)
      setMembers(groupRes.members)
      setLoaded(true)

      // Arriving straight from group creation → open the invite link to share.
      if (
        match.isOwner &&
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('share') === '1'
      ) {
        setInviteOpen(true)
      }
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

  async function handleLeave() {
    if (leaving) return
    setLeaving(true)
    posthog.capture('group_left')
    try {
      const res = await fetch(`/api/groups/${groupId}/leave`, { method: 'POST' })
      if (!res.ok) throw new Error('leave failed')
      router.push('/people')
    } catch {
      setError("Couldn't leave, try again.")
      setLeaving(false)
    }
  }

  async function handleAddFriend(id: string) {
    if (addingId) return
    setAddingId(id)
    const setRelation = (relation: RosterMember['relation']) =>
      setMembers(prev => prev.map(m => (m.id === id ? { ...m, relation } : m)))
    setRelation('asked')
    try {
      const res = await fetch(`/api/friend-requests/${id}`, { method: 'POST' })
      if (!res.ok) throw new Error('failed')
      const data = (await res.json()) as { status: string; crossed?: boolean }
      posthog.capture('friend_request_sent', { source: 'group_roster' })
      // They had already asked you — the server made it a friendship.
      if (data.crossed) setRelation('friend')
    } catch {
      setRelation('add')
      setError("Couldn't do that, try again.")
    } finally {
      setAddingId(null)
    }
  }

  if (!loaded || !group) {
    return (
      <main className="min-h-screen bg-purple-50 flex items-center justify-center">
        <p className="font-sans text-[14px] text-ink-500">Loading…</p>
      </main>
    )
  }

  // Member (not owner): read-only roster + leave.
  if (!group.isOwner) {
    // Owner first, as before.
    const ordered = [...members].sort((a, b) => Number(b.isOwner) - Number(a.isOwner))
    return (
      <GroupMemberView
        groupId={groupId}
        name={group.name}
        emoji={group.emoji}
        members={ordered}
        leaving={leaving}
        addingId={addingId}
        onBack={() => router.push('/people')}
        onLeave={() => void handleLeave()}
        onAddFriend={id => void handleAddFriend(id)}
      />
    )
  }

  // Owner: full edit.
  return (
    <>
      <GroupForm
        title={group.name}
        initialName={group.name}
        initialEmoji={group.emoji}
        initialMemberIds={group.memberIds}
        friends={friends}
        others={members.filter(m => m.relation !== 'you' && m.relation !== 'friend')}
        addingId={addingId}
        onAddFriend={id => void handleAddFriend(id)}
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
        <h2 className="font-display font-bold text-[18px] text-ink-900 tracking-tight mb-2">
          Delete {group.name}?
        </h2>
        <p className="font-sans text-[14px] text-ink-500 leading-relaxed mb-6">
          Your friends won&apos;t be affected, this just removes the group.
        </p>
        <button
          onClick={() => void handleConfirmDelete()}
          className="w-full py-3.5 rounded-2xl bg-red-tint text-red-500 font-sans font-semibold text-[15px] mb-2"
        >
          Delete
        </button>
        <button
          onClick={() => {
            posthog.capture('group_delete_cancelled')
            setDeleteOpen(false)
          }}
          className="w-full py-3.5 rounded-2xl bg-purple-50 text-ink-500 font-sans font-semibold text-[15px]"
        >
          Cancel
        </button>
      </Sheet>
    </>
  )
}
