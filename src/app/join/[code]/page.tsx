// Screen 1: Invite Link Landing Page
// Mockup: mooves-screen1-invite-landing.html
// URL: makemooves.app/join/[code]

import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { verifySessionToken } from '@/lib/auth/session'
import InviteLanding from '@/components/invite/InviteLanding'

interface Props {
  params: Promise<{ code: string }>
}

// ── Inviter lookup (server-side, cached 1h) ───────────────────────────────
async function getInviter(code: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('users')
    .select('id, display_name, avatar_url')
    .eq('referral_code', code)
    .single()
  return data
}

// Resolves the visitor's logged-in user id from the mooves-token cookie, if any.
// The /join route is public, so middleware never populates x-user-id here.
async function getSessionUserId(): Promise<string | null> {
  const token = (await cookies()).get('mooves-token')?.value
  if (!token) return null
  const payload = await verifySessionToken(token)
  return payload?.sub ?? null
}

// ── Dynamic OG metadata ────────────────────────────────────────────────────
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params
  const inviter = await getInviter(code)

  if (!inviter) {
    return {
      title: 'Join Mooves',
      description: 'See when your friends are free, without having to ask.',
    }
  }

  return {
    title: `${inviter.display_name} invited you to Mooves`,
    description: 'See when your friends are free, without having to ask.',
    openGraph: {
      title: `${inviter.display_name} invited you to Mooves`,
      description: 'See when your friends are free, without having to ask.',
      url: `${process.env.NEXT_PUBLIC_APP_URL}/join/${code}`,
      images: [{ url: `/join/${code}/opengraph-image` }],
    },
  }
}

// ── Page component ─────────────────────────────────────────────────────────
export default async function InvitePage({ params }: Props) {
  const { code } = await params
  const inviter = await getInviter(code)
  const userId = await getSessionUserId()

  // Logged-in visitor with a valid code → decide State B vs C server-side.
  if (userId && inviter && inviter.id !== userId) {
    const supabase = createServiceClient()
    const { data: friendship } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', userId)
      .eq('friend_id', inviter.id)
      .maybeSingle()

    if (friendship) {
      // State C — already friends. Feed's resolveInvite fires the "already friends" toast.
      redirect(`/feed?invite=${code}`)
    }

    // State B — existing user, not yet friends.
    return (
      <InviteLanding
        state="B"
        code={code}
        inviterName={inviter.display_name}
        inviterAvatarUrl={inviter.avatar_url}
      />
    )
  }

  // No session (or self-invite): State A (valid code) or State D (invalid code).
  return (
    <InviteLanding
      state={inviter ? 'A' : 'D'}
      code={code}
      inviterName={inviter?.display_name ?? null}
      inviterAvatarUrl={inviter?.avatar_url ?? null}
    />
  )
}
