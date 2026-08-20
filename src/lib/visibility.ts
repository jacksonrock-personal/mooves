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

/**
 * The audience fields every caller of `canSeePlan` has to select.
 *
 * `open_to_fof` is REQUIRED rather than optional, deliberately. Optional would
 * compile for a caller that forgot to select it and then silently deny every
 * one-hop-out viewer — a wrong answer that looks like a working feature. Making
 * it required turns that into a type error at the call site.
 */
export interface PlanAudience {
  author_id: string
  visible_to: string[] | null
  visible_user_ids: string[] | null
  open_to_fof: boolean
}

/**
 * R29 — is `viewer` exactly one hop from `authorId`?
 *
 * Mirrors the `fof` CTE in get_plans and has to keep mirroring it: the feed
 * decides what you can SEE, this decides what you can JOIN and COMMENT on, and
 * the two disagreeing is the bug R27 spent three weeks shipping.
 *
 * Four conditions, all required — the viewer accepts one-hop Mooves at all,
 * has not hidden this author, is not already their friend (checked by the
 * caller), and some friend of theirs is friends with the author.
 */
async function isOneHopOut(
  supabase: ReturnType<typeof createServiceClient>,
  authorId: string,
  viewerId: string,
): Promise<boolean> {
  const { data: me } = await supabase
    .from('users')
    .select('fof_mooves_enabled')
    .eq('id', viewerId)
    .maybeSingle()
  if (!me?.fof_mooves_enabled) return false

  const { data: hidden } = await supabase
    .from('fof_hidden')
    .select('hidden_user_id')
    .eq('user_id', viewerId)
    .eq('hidden_user_id', authorId)
    .maybeSingle()
  if (hidden) return false

  // Two hops, as two bounded reads rather than one join, because supabase-js
  // cannot express the self-join and a user's friend list is small.
  const { data: mine } = await supabase
    .from('friendships')
    .select('friend_id')
    .eq('user_id', viewerId)
  const bridgeIds = (mine ?? []).map(f => f.friend_id)
  if (bridgeIds.length === 0) return false

  const { data: bridge } = await supabase
    .from('friendships')
    .select('user_id')
    .in('user_id', bridgeIds)
    .eq('friend_id', authorId)
    .limit(1)

  return (bridge?.length ?? 0) > 0
}

/**
 * Can this user see this Moove at all?
 *
 * THE SAME PREDICATE AS `get_plans`, AND THAT IS THE ENTIRE POINT. R16 added
 * individual scoping to the SQL and to the composer, and the join route kept a
 * hand-written copy that only knew about `visible_to`. Because a Moove scoped
 * to named individuals leaves `visible_to` NULL, that copy skipped its audience
 * check entirely and let any friend of the author join something they were
 * never shown. The feed and the join gate disagreed for three weeks.
 *
 * R28 needed the same rule a third time, for comments. Three hand-written
 * copies of a security predicate is not a risk, it is a scheduled outage, so
 * the rule lives here now and the routes call it.
 *
 * It deliberately does NOT check cancelled_at or expires_at. Those are about
 * whether a Moove is still alive, which every caller words differently in its
 * own response; this answers only "is this person in the audience".
 */
export async function canSeePlan(
  supabase: ReturnType<typeof createServiceClient>,
  plan: PlanAudience,
  userId: string,
): Promise<boolean> {
  if (plan.author_id === userId) return true

  const [{ data: friendship }, { data: myGroups }] = await Promise.all([
    supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', userId)
      .eq('friend_id', plan.author_id)
      .maybeSingle(),
    // viewer_group_ids, not group_members: a group's OWNER has no membership
    // row, and reading the table directly is how get_feed lost sight of owners.
    supabase.rpc('viewer_group_ids', { p_user: userId }),
  ])

  const groupScoped = (plan.visible_to?.length ?? 0) > 0
  const userScoped = (plan.visible_user_ids?.length ?? 0) > 0

  if (!friendship) {
    // R29 — the one-hop arm. Note the order: scoping is checked BEFORE the
    // expensive graph walk, and a scoped Moove is refused outright however
    // `open_to_fof` reads. Narrowing beats widening, always, and saying so here
    // as well as in the write path means a row that somehow carried both could
    // still never reach a stranger.
    if (!plan.open_to_fof) return false
    if (groupScoped || userScoped) return false
    return isOneHopOut(supabase, plan.author_id, userId)
  }

  // Unscoped means NEITHER array was set — visible to all of the author's
  // friends. An empty array is treated as unset, matching the SQL.
  if (!groupScoped && !userScoped) return true

  const mine = new Set(((myGroups as { group_id: string }[]) ?? []).map(g => g.group_id))
  const viaGroup = plan.visible_to?.some(g => mine.has(g)) ?? false
  const viaName = plan.visible_user_ids?.includes(userId) ?? false
  return viaGroup || viaName
}
