// Phase 24.4 — activation, defined as the thing that actually predicts retention.
//
// A user is activated on their first RECIPROCAL event: someone joined their
// green or Moove, or they joined someone's. Not on signup, not on completing
// onboarding, and explicitly NOT on invites sent — that last one is a vanity
// number that can be large while activation is zero, which is precisely the
// failure this phase exists to fix.
//
// A join activates BOTH sides. The joiner did something with a friend; the
// author had something land. Either way the app just worked for them for the
// first time, and that is the moment worth compressing time-to.
//
// Set once, never cleared. `activated_at IS NULL` is the filter, so a second
// join is a no-op rather than a moved goalpost.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export async function markActivated(
  supabase: SupabaseClient<Database>,
  userIds: (string | null | undefined)[],
): Promise<void> {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))]
  if (ids.length === 0) return

  // Best-effort and never on the critical path: failing to record activation
  // must not fail the join that caused it.
  const { error } = await supabase
    .from('users')
    .update({ activated_at: new Date().toISOString() })
    .in('id', ids)
    .is('activated_at', null)

  if (error) console.error('markActivated failed:', error)
}
