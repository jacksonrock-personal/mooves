'use client'

// Screen 9: Groups sub-tab content — list of the user's groups with
// swipe-to-delete, an empty state, and a delete confirmation sheet.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { initPostHog, posthog } from '@/lib/posthog'
import Sheet from '@/components/ui/Sheet'
import Toast from '@/components/ui/Toast'
import GroupRow from './GroupRow'

interface Group {
  id: string
  name: string
  emoji: string
  memberCount: number
  isOwner: boolean
}

export default function GroupsPanel() {
  const router = useRouter()
  const [groups, setGroups] = useState<Group[] | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    initPostHog()
    posthog.capture('groups_tab_viewed')

    fetch('/api/groups')
      .then(r => r.json() as Promise<{ groups: Group[] }>)
      .then(data => {
        if (!cancelled) setGroups(data.groups ?? [])
      })
      .catch(() => {
        if (!cancelled) setGroups([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  function handleCreate() {
    posthog.capture('group_create_started')
    router.push('/people/groups/new')
  }

  function handleEdit(id: string) {
    posthog.capture('group_edit_opened')
    router.push(`/people/groups/${id}`)
  }

  function handleDeleteInitiated(id: string, name: string) {
    posthog.capture('group_delete_initiated')
    setDeleteTarget({ id, name })
  }

  function handleCancelDelete() {
    posthog.capture('group_delete_cancelled')
    setDeleteTarget(null)
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    posthog.capture('group_delete_confirmed')

    setGroups(prev => (prev ?? []).filter(g => g.id !== target.id))

    try {
      const res = await fetch(`/api/groups/${target.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
    } catch {
      // Restore on failure and refetch to recover the original order.
      setToastMessage(`Couldn't delete ${target.name}, try again.`)
      const data = (await fetch('/api/groups').then(r => r.json())) as { groups: Group[] }
      setGroups(data.groups ?? [])
    }
  }

  const loaded = groups !== null
  const isEmpty = loaded && groups.length === 0

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {loaded &&
        (isEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 bg-surface-bg">
            <div className="w-[52px] h-[52px] rounded-2xl bg-purple-tint flex items-center justify-center text-[26px] leading-none mb-4">
              👥
            </div>
            <p className="font-display font-extrabold text-[18px] text-text-primary tracking-tight mb-2">
              No groups yet.
            </p>
            <p className="font-sans text-[14px] text-text-secondary leading-relaxed mb-7">
              Groups let you choose who sees you when you go green.
            </p>
            <button
              onClick={handleCreate}
              className="w-full py-3.5 rounded-2xl bg-mooves-purple text-white font-display font-bold text-[15px] tracking-tight"
            >
              Create a group
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto bg-card-white">
            {groups.map(g => (
              <GroupRow
                key={g.id}
                id={g.id}
                name={g.name}
                emoji={g.emoji}
                memberCount={g.memberCount}
                onTap={handleEdit}
                onDelete={g.isOwner ? handleDeleteInitiated : undefined}
              />
            ))}
            {groups.some(g => g.isOwner) && (
              <p className="font-sans text-[11px] text-text-secondary/70 text-center px-5 pt-2 pb-1 bg-card-white">
                Swipe left on a group you own to delete it
              </p>
            )}
          </div>
        ))}

      <Sheet
        open={deleteTarget !== null}
        onClose={handleCancelDelete}
        className="px-5 pb-8"
      >
        <h2 className="font-display font-bold text-[18px] text-text-primary tracking-tight mb-2">
          Delete {deleteTarget?.name}?
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
          onClick={handleCancelDelete}
          className="w-full py-3.5 rounded-2xl bg-surface-bg text-text-secondary font-sans font-semibold text-[15px]"
        >
          Cancel
        </button>
      </Sheet>

      {toastMessage && (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      )}
    </div>
  )
}
