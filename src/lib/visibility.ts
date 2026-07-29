// R16 — visibility that can name a person.
//
// One place, deliberately. Three routes write an individual-scoped audience
// (`PATCH /api/status`, `POST /api/plans`, `PATCH /api/plans/[id]`) and all
// three need the same friendship check. Three hand-written copies is how the
// picker and the write path drift apart — `plan_taggable_friends` exists in the
// database because exactly that already happened once with tagging.
//
// The rule: you may only scope something to people you are actually friends
// with. A hand-built request naming a stranger has those ids DROPPED rather
// than the whole write rejected, matching how R8 handles comment mentions: the
// legitimate part of the request still lands.

import type { createServiceClient } from '@/lib/supabase/server'

/** Nobody needs to name more people than this, and it bounds the array we store. */
const MAX_SPECIFIC_FRIENDS = 100

/**
 * Reduce a client-supplied list of user ids to the subset the author is really
 * friends with, de-duped and capped.
 *
 * Returns `null` — not `[]` — when nothing survives, because null is what the
 * database predicate reads as "not scoped to individuals". An empty array would
 * make `viewer = ANY('{}')` false for everyone while ALSO failing the
 * `visible_user_ids IS NULL` test, producing a Moove nobody at all can see.
 */
export async function sanitizeVisibleUserIds(
  supabase: ReturnType<typeof createServiceClient>,
  authorId: string,
  ids: unknown,
): Promise<string[] | null> {
  if (!Array.isArray(ids)) return null

  const wanted = [...new Set(ids.filter((v): v is string => typeof v === 'string' && v.length > 0))]
    .filter(id => id !== authorId) // scoping a thing to yourself is a no-op
    .slice(0, MAX_SPECIFIC_FRIENDS)

  if (wanted.length === 0) return null

  const { data, error } = await supabase
    .from('friendships')
    .select('friend_id')
    .eq('user_id', authorId)
    .in('friend_id', wanted)

  // Fail CLOSED. If we cannot prove friendship we do not store the scope — the
  // alternative is trusting the client's list, which is the whole thing this
  // function exists to prevent.
  if (error) {
    console.error('visible_user_ids friendship check failed:', error)
    return null
  }

  const allowed = (data ?? []).map(f => f.friend_id)
  return allowed.length > 0 ? allowed : null
}
