// GET    /api/groups/[id] — the group + its full roster (names, avatars)
// PATCH  /api/groups/[id] — update name, emoji, or member list (full replacement)
// DELETE /api/groups/[id] — delete group (cascades to group_members)

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

// How the viewer relates to someone in the group, for the roster's right edge:
//   friend  → nothing to do
//   add     → can_request_friend says yes; show "Add friend"
//   asked   → you have a pending request out to them
//   none    → not addable (opted out of suggestions, or declined) — show nothing
export type RosterRelation = 'you' | 'friend' | 'add' | 'asked' | 'none'

export interface GroupRosterMember {
  id: string
  displayName: string | null
  avatarUrl: string | null
  isOwner: boolean
  relation: RosterRelation
}

// The roster is served by the group, not assembled from the viewer's friends
// list: two people can share a group without being friends (one joined via the
// invite link), and resolving names client-side left those rows as "Friend"
// with a blank avatar. Being in the group is the entitlement to see who else
// is — so the guard is membership, checked before anything is read.
export async function GET(req: Request, { params }: Params) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const { data: group } = await supabase
    .from('groups')
    .select('id, name, emoji, owner_id, group_members(user_id)')
    .eq('id', id)
    .maybeSingle()

  const memberIds = (group?.group_members ?? []).map((m: { user_id: string }) => m.user_id)
  // 404, not 403: a non-member probing ids learns nothing about whether the group exists.
  if (!group || (group.owner_id !== userId && !memberIds.includes(userId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const everyone = Array.from(new Set([group.owner_id, ...memberIds]))
  const others = everyone.filter(uid => uid !== userId)

  const [{ data: users }, { data: friendRows }, { data: sentRows }] = await Promise.all([
    supabase.from('users').select('id, display_name, avatar_url').in('id', everyone),
    supabase.from('friendships').select('friend_id').eq('user_id', userId).in('friend_id', others),
    supabase
      .from('friend_requests')
      .select('recipient_id')
      .eq('requester_id', userId)
      .eq('status', 'pending')
      .in('recipient_id', others),
  ])

  const userById = new Map((users ?? []).map(u => [u.id, u]))
  const friendSet = new Set((friendRows ?? []).map(f => f.friend_id))
  const askedSet = new Set((sentRows ?? []).map(r => r.recipient_id))

  // Only the non-friends without a pending ask need the reachability check —
  // the same guard POST /api/friend-requests enforces, so the button never
  // offers a tap the server will refuse. Groups are small; this is a handful.
  const unknown = others.filter(uid => !friendSet.has(uid) && !askedSet.has(uid))
  const addable = new Set<string>()
  await Promise.all(
    unknown.map(async uid => {
      const { data } = await supabase.rpc('can_request_friend', { viewer: userId, target: uid })
      if (data) addable.add(uid)
    }),
  )

  const relationOf = (uid: string): RosterRelation =>
    uid === userId
      ? 'you'
      : friendSet.has(uid)
        ? 'friend'
        : askedSet.has(uid)
          ? 'asked'
          : addable.has(uid)
            ? 'add'
            : 'none'

  const members: GroupRosterMember[] = everyone.map(uid => {
    const u = userById.get(uid)
    return {
      id: uid,
      displayName: u?.display_name ?? null,
      avatarUrl: u?.avatar_url ?? null,
      isOwner: uid === group.owner_id,
      relation: relationOf(uid),
    }
  })

  return NextResponse.json({
    group: {
      id: group.id,
      name: group.name,
      emoji: group.emoji,
      ownerId: group.owner_id,
      isOwner: group.owner_id === userId,
      memberIds,
    },
    members,
  })
}

export async function PATCH(req: Request, { params }: Params) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  // Verify ownership
  const { data: group } = await supabase
    .from('groups')
    .select('id, name, emoji, group_members(user_id)')
    .eq('id', id)
    .eq('owner_id', userId)
    .single()

  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json() as {
    name?: string
    emoji?: string
    memberIds?: string[]
  }

  type GroupUpdate = { name?: string; emoji?: string }
  const updates: GroupUpdate = {}
  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name || name.length > 40) return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
    updates.name = name
  }
  if (body.emoji !== undefined) updates.emoji = body.emoji

  if (Object.keys(updates).length > 0) {
    await supabase.from('groups').update(updates).eq('id', id)
  }

  // Replace member list if provided (may be empty — groups can grow via the link)
  if (body.memberIds !== undefined) {
    await supabase.from('group_members').delete().eq('group_id', id)
    if (body.memberIds.length > 0) {
      await supabase.from('group_members').insert(
        body.memberIds.map(uid => ({ group_id: id, user_id: uid }))
      )
    }
  }

  const { data: updated } = await supabase
    .from('groups')
    .select('id, name, emoji, group_members(user_id)')
    .eq('id', id)
    .single()

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    emoji: updated.emoji,
    memberCount: updated.group_members.length,
    memberIds: updated.group_members.map((m: { user_id: string }) => m.user_id),
  })
}

export async function DELETE(req: Request, { params }: Params) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('groups')
    .delete()
    .eq('id', id)
    .eq('owner_id', userId)

  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })

  return new Response(null, { status: 204 })
}
