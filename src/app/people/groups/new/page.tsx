'use client'

// Screen 9: Create Group (full-screen push)
// Mockup: mooves-screen9-groups.html

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { posthog } from '@/lib/posthog'
import GroupForm from '@/components/groups/GroupForm'

interface Friend {
  id: string
  displayName: string | null
  avatarUrl: string | null
}

export default function NewGroupPage() {
  const router = useRouter()
  const [friends, setFriends] = useState<Friend[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/friends')
      .then(r => r.json() as Promise<{ friends: Friend[] }>)
      .then(d => setFriends(d.friends ?? []))
      .catch(() => setFriends([]))
  }, [])

  async function handleSave(name: string, emoji: string, memberIds: string[]) {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, emoji, memberIds }),
      })
      if (!res.ok) throw new Error('save failed')
      posthog.capture('group_create_completed')
      router.push('/people')
    } catch {
      setError("Couldn't save, try again.")
      setSaving(false)
    }
  }

  return (
    <GroupForm
      title="New group"
      friends={friends}
      saving={saving}
      error={error}
      onSave={handleSave}
      onBack={() => router.push('/people')}
    />
  )
}
