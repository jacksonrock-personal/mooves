// Admin gating (Phase 13 surface 2). Every /api/admin/* route must call this;
// never trust a client-supplied admin claim.

import { createServiceClient } from '@/lib/supabase/server'

export async function requireAdmin(userId: string | null): Promise<boolean> {
  if (!userId) return false
  const supabase = createServiceClient()
  const { data } = await supabase.from('users').select('is_admin').eq('id', userId).single()
  return data?.is_admin === true
}
