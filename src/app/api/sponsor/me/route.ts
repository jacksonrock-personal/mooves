// GET /api/sponsor/me — the signed-in sponsor's profile (401 if not a sponsor).

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireSponsor } from '@/lib/sponsor'

export async function GET() {
  const sponsorId = await requireSponsor()
  if (!sponsorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('sponsors')
    .select('id, phone, business_name')
    .eq('id', sponsorId)
    .single()

  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ id: data.id, phone: data.phone, businessName: data.business_name })
}
