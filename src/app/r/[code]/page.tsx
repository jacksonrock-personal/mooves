// Phase 19.1 — "Add everyone here" landing.
// URL: makemooves.app/r/[code], reached by a phone camera pointed at the host's
// screen. Public: scanners may not have an account yet.

import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/server'
import { verifySessionToken } from '@/lib/auth/session'
import { ROUNDUP_CAP } from '@/lib/roundup'
import RoundupJoinLanding, { type RoundupLandingState } from '@/components/invite/RoundupJoinLanding'

interface Props {
  params: Promise<{ code: string }>
}

async function getRoundup(code: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('roundups')
    .select('id, host_id, closed_at, expires_at, roundup_members(user_id), users!roundups_host_id_fkey(display_name)')
    .eq('code', code)
    .maybeSingle()
  return data as
    | {
        id: string
        host_id: string
        closed_at: string | null
        expires_at: string
        roundup_members: { user_id: string }[]
        users: { display_name: string | null } | null
      }
    | null
}

async function getSessionUserId(): Promise<string | null> {
  const token = (await cookies()).get('mooves-token')?.value
  if (!token) return null
  const payload = await verifySessionToken(token)
  return payload?.sub ?? null
}

// Metadata must not leak either — a link pasted into a chat should not preview
// the host's name to people who were never in the room.
export const metadata: Metadata = {
  title: 'Join on Mooves',
  description: 'See when your friends are free, without having to ask.',
}

export default async function RoundupJoinPage({ params }: Props) {
  const { code } = await params
  const roundup = await getRoundup(code)
  const userId = await getSessionUserId()

  function render(state: RoundupLandingState, hostName: string | null, count: number) {
    return (
      <RoundupJoinLanding
        state={state}
        code={code}
        hostName={hostName}
        memberCount={count}
        loggedIn={!!userId}
      />
    )
  }

  // Unknown, closed, or expired all collapse to the same dead state, and it
  // names nobody. A stranger with a spent link learns nothing about the room.
  const isDead =
    !roundup || roundup.closed_at !== null || new Date(roundup.expires_at) <= new Date()
  if (isDead) return render('dead', null, 0)

  const memberIds = roundup.roundup_members.map(m => m.user_id)
  const hostName = roundup.users?.display_name ?? null

  if (userId && memberIds.includes(userId)) return render('already', hostName, memberIds.length)
  if (memberIds.length >= ROUNDUP_CAP) return render('full', null, 0)

  return render('consent', hostName, memberIds.length)
}
