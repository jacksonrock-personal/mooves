// Dynamic OG image for invite links
// Generates the preview card shown when the link is shared in iMessage, Slack, etc.
// Shows the inviter's face + name — significantly boosts click-through.

import { ImageResponse } from 'next/og'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const supabase = createServiceClient()
  const { data: inviter } = await supabase
    .from('users')
    .select('display_name, avatar_url')
    .eq('referral_code', code)
    .single()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #7C5CDB 0%, #9B7FE8 60%, #A98FF0 100%)',
          fontFamily: '"Plus Jakarta Sans", sans-serif',
          color: 'white',
        }}
      >
        {/* Wordmark */}
        <div style={{ fontSize: 48, fontWeight: 800, marginBottom: 48, letterSpacing: '-1px' }}>
          Mooves
        </div>

        {/* Inviter avatar */}
        {inviter?.avatar_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={inviter.avatar_url}
            alt={inviter.display_name ?? ''}
            width={120}
            height={120}
            style={{ borderRadius: '50%', border: '4px solid rgba(255,255,255,0.5)', marginBottom: 24 }}
          />
        )}

        {/* Headline */}
        <div style={{ fontSize: 40, fontWeight: 700, textAlign: 'center', maxWidth: 800 }}>
          {inviter
            ? `${inviter.display_name} invited you to Mooves`
            : "You've been invited to Mooves"}
        </div>

        {/* Value prop */}
        <div style={{ fontSize: 24, marginTop: 20, opacity: 0.85, textAlign: 'center' }}>
          See when your friends are free, without having to ask.
        </div>
      </div>
    ),
    { ...size }
  )
}
