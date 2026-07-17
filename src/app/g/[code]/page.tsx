// Phase 10.2: Group invite link landing.
// URL: makemooves.app/g/[code]

import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/server'
import { verifySessionToken } from '@/lib/auth/session'
import GroupJoinLanding from '@/components/invite/GroupJoinLanding'

interface Props {
  params: Promise<{ code: string }>
}

async function getGroup(code: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('groups')
    .select('id, name, emoji, owner_id, group_members(user_id)')
    .eq('invite_code', code)
    .maybeSingle()
  return data
}

// Resolve the visitor's logged-in user id from the mooves-token cookie, if any.
// The /g route is public, so middleware never populates x-user-id here.
async function getSessionUserId(): Promise<string | null> {
  const token = (await cookies()).get('mooves-token')?.value
  if (!token) return null
  const payload = await verifySessionToken(token)
  return payload?.sub ?? null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params
  const group = await getGroup(code)
  if (!group) return { title: 'Join a group on Mooves' }
  return {
    title: `Join ${group.name} on Mooves`,
    description: 'See when your friends are free, without having to ask.',
  }
}

export default async function GroupJoinPage({ params }: Props) {
  const { code } = await params
  const group = await getGroup(code)
  const userId = await getSessionUserId()

  if (!group) {
    return (
      <GroupJoinLanding state="dead" code={code} name={null} emoji={null} memberCount={0} loggedIn={!!userId} />
    )
  }

  const memberIds = group.group_members.map(m => m.user_id)
  const memberCount = new Set<string>([group.owner_id, ...memberIds]).size
  const alreadyMember = !!userId && (group.owner_id === userId || memberIds.includes(userId))

  return (
    <GroupJoinLanding
      state={alreadyMember ? 'already' : 'consent'}
      code={code}
      name={group.name}
      emoji={group.emoji}
      memberCount={memberCount}
      loggedIn={!!userId}
    />
  )
}
