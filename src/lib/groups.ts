// Group membership, resolved consistently.
//
// `group_members` never holds a group's OWNER — ownership is carried by
// groups.owner_id alone, and that is load-bearing (the group_members_owner_all
// RLS policy keys off it; /api/groups/[id]/leave refuses to let an owner leave;
// PUT /api/groups/[id] replaces the member list wholesale and would wipe an
// owner row on every edit). So a raw `group_members` query silently treats the
// owner as an outsider to their own group.
//
// Every caller that asks a membership question goes through here. The SQL side
// of the same rule is public.viewer_group_ids(uuid), used by get_feed and
// wave_group_for_viewer (migration 20260727183000).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Client = SupabaseClient<Database>

/**
 * Every group `userId` belongs to — joined OR owns.
 * `restrictTo` narrows the lookup to a candidate set (e.g. the group ids a
 * green was scoped to), which is all a visibility check needs.
 */
export async function userGroupIds(
  supabase: Client,
  userId: string,
  restrictTo?: string[],
): Promise<Set<string>> {
  if (restrictTo && restrictTo.length === 0) return new Set()

  const memberQuery = supabase.from('group_members').select('group_id').eq('user_id', userId)
  const ownerQuery = supabase.from('groups').select('id').eq('owner_id', userId)

  const [{ data: memberRows }, { data: ownedRows }] = await Promise.all([
    restrictTo ? memberQuery.in('group_id', restrictTo) : memberQuery,
    restrictTo ? ownerQuery.in('id', restrictTo) : ownerQuery,
  ])

  return new Set([
    ...(memberRows ?? []).map(r => r.group_id),
    ...(ownedRows ?? []).map(r => r.id),
  ])
}

/**
 * Everyone in `groupId` — members plus the owner. The audience for anything
 * addressed to a group.
 */
export async function groupRecipientIds(supabase: Client, groupId: string): Promise<string[]> {
  const [{ data: memberRows }, { data: group }] = await Promise.all([
    supabase.from('group_members').select('user_id').eq('group_id', groupId),
    supabase.from('groups').select('owner_id').eq('id', groupId).maybeSingle(),
  ])

  const ids = new Set((memberRows ?? []).map(m => m.user_id))
  if (group?.owner_id) ids.add(group.owner_id)
  return [...ids]
}
