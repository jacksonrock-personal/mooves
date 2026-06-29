// Screen 1: Invite Link Landing Page
// Mockup: mooves-screen1-invite-landing.html
// URL: makemooves.app/join/[code]

import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ code: string }>
}

// ── Inviter lookup (server-side, cached 1h) ───────────────────────────────
async function getInviter(code: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('users')
    .select('display_name, avatar_url')
    .eq('referral_code', code)
    .single()
  return data
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

// ── Page component (stub — implement after mockup approval) ────────────────
export default async function InvitePage({ params }: Props) {
  const { code } = await params
  const inviter = await getInviter(code)

  // TODO: implement Screen 1 UI using mooves-screen1-invite-landing.html as reference
  return (
    <main className="min-h-screen flex items-center justify-center bg-mooves-purple">
      <p className="text-white font-display font-bold text-xl">
        {inviter
          ? `${inviter.display_name} invited you to Mooves`
          : 'You've been invited to Mooves'}
      </p>
    </main>
  )
}
