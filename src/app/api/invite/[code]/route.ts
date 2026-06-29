// GET /api/invite/[code]
// Public endpoint — no auth required.
// Returns the inviter's display name and avatar so the landing page can render.
// Returns 404 if the code doesn't exist (triggers State D generic landing).

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('users')
    .select('display_name, avatar_url')
    .eq('referral_code', code)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(
    { display_name: data.display_name, avatar_url: data.avatar_url },
    {
      headers: {
        // Cache for 1 hour — inviter profile changes rarely
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    }
  )
}
