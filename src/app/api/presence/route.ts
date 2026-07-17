// POST /api/presence — heartbeat: mark the current user active now (10.1).
// Called on app foreground; powers the aggregate "N friends around now" signal.
// Write-only, no body. Never returns who is active (aggregate counts only).

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  await supabase
    .from('users')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', userId)

  return NextResponse.json({ ok: true })
}
