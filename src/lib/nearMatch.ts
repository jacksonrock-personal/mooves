// Phase 24.7 — who, if anyone, gets named on a Community or Sponsored Moove.
//
// Two signals live here and they are NOT interchangeable:
//
//   DECLARED — a friend tapped "I'd go". A fact. Renders solid, with their name.
//   COMPUTED — we think they'd probably go. A guess. Renders dimmed, hedged
//              ("would probably go"), and never as a standalone claim: the card's
//              single CTA is what turns it into an actual invitation.
//
// THE CONFIDENCE FLOOR (24.0, wall 3). A computed line requires GREEN OVERLAP —
// the friend has themselves declared they are free when the thing happens.
// Interest match alone is never enough. This is the whole reason the feature is
// defensible: we are never inventing availability, only noticing that someone
// already said they were free and that something they might like falls in it.
//
// Consequences that fall out of that floor, both intended:
//   · An evergreen move (start_at NULL) can never carry a computed line. There
//     is no window to overlap, so there is nothing to be confident about.
//   · A friend with hide_from_matches never appears, in any computed form.
//
// Computed in TypeScript rather than SQL on purpose: the volumes are tiny (a
// handful of moves against one person's friends), the rules above are the kind
// that need to be read and argued with, and a new SQL function would mean
// another migration for logic that changes far more often than schema does.

import { SLOT_WINDOW, type SlotPart } from './availability'

export interface NearFriend {
  id: string
  displayName: string | null
  avatarUrl: string | null
}

/** Everything about one friend that bears on whether they get named. */
export interface FriendSignal extends NearFriend {
  /** 24.0 wall 4 — one switch, and they vanish from every computed line. */
  hideFromMatches: boolean
  interests: string[]
  /** Group ids they share with the viewer, for the group-fit band. */
  groupIds: string[]
  /** A live green: free now, until statusExpiresAt (null = no stated end). */
  isAvailable: boolean
  statusExpiresAt: string | null
  /** Phase 22 scheduled availability, in the friend's own local dates. */
  slots: { date: string; part: SlotPart }[]
  /** IANA zone; slots are local to it. Falls back to the viewer's. */
  timezone: string | null
}

export type SocialLine =
  | { kind: 'declared'; friends: NearFriend[] }
  | { kind: 'groupFit'; groupId: string; groupName: string; count: number }
  | { kind: 'computed'; friends: NearFriend[] }

/**
 * The move's local calendar date and hour in a given zone.
 *
 * Availability slots are stored as a local date plus a coarse part, so a
 * timestamptz has to be read in the FRIEND's zone, not the server's or the
 * viewer's. Someone free "Thursday evening" in Chicago is not free for an event
 * that is Thursday evening in London.
 */
function localDateAndHour(iso: string, timeZone: string): { date: string; hour: number } | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(d)
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
    const date = `${get('year')}-${get('month')}-${get('day')}`
    // 24-hour formatting yields "24" for midnight in some engines.
    const hour = Number(get('hour')) % 24
    if (!date.trim() || Number.isNaN(hour)) return null
    return { date, hour }
  } catch {
    // Bad IANA zone — treat as no overlap rather than guessing.
    return null
  }
}

/**
 * Has this friend already declared they are free when the move happens?
 *
 * Two independent ways to qualify, either is enough:
 *   1. A live green that is still running when the move starts.
 *   2. A Phase 22 scheduled slot whose local window contains the move's hour.
 */
export function hasGreenOverlap(
  friend: FriendSignal,
  startAt: string | null,
  viewerTimezone: string,
  now: Date = new Date(),
): boolean {
  // No window, nothing to overlap. Evergreen moves never qualify.
  if (!startAt) return false
  const start = new Date(startAt)
  if (Number.isNaN(start.getTime())) return false
  // Already begun (or long past) — not a thing to plan toward.
  if (start.getTime() < now.getTime()) return false

  // 1 — a live green that outlasts the start.
  if (friend.isAvailable) {
    if (!friend.statusExpiresAt) return true
    const expires = new Date(friend.statusExpiresAt)
    if (!Number.isNaN(expires.getTime()) && expires.getTime() >= start.getTime()) return true
  }

  // 2 — a scheduled slot covering it, read in the friend's own zone.
  const zone = friend.timezone || viewerTimezone
  const local = localDateAndHour(startAt, zone)
  if (!local) return false
  return friend.slots.some(s => {
    if (s.date !== local.date) return false
    const w = SLOT_WINDOW[s.part]
    return !!w && local.hour >= w.start && local.hour < w.end
  })
}

const strip = ({ id, displayName, avatarUrl }: FriendSignal): NearFriend => ({
  id,
  displayName,
  avatarUrl,
})

/**
 * Pick the one line a card carries, in strict precedence order.
 *
 *   declared  — somebody actually said so. Always wins; a friend who declared is
 *               never also counted as a guess.
 *   groupFit  — two or more free friends from the same group. The strongest
 *               computed signal there is, because it rests entirely on greens
 *               those people declared themselves.
 *   computed  — individual guesses, hedged.
 *
 * Returns null when there is nothing honest to say, which is the common case and
 * is fine: a card with no social line is still a card.
 */
export function buildSocialLine(
  opts: {
    startAt: string | null
    category: string | null
    declaredFriendIds: string[]
    friends: FriendSignal[]
    groupNames: Map<string, string>
    viewerTimezone: string
    now?: Date
  },
): SocialLine | null {
  const { startAt, category, declaredFriendIds, friends, groupNames, viewerTimezone } = opts
  const now = opts.now ?? new Date()

  // ── declared ───────────────────────────────────────────────────────────────
  const declaredSet = new Set(declaredFriendIds)
  const declared = friends.filter(f => declaredSet.has(f.id))
  if (declared.length > 0) {
    return { kind: 'declared', friends: declared.map(strip) }
  }

  // ── everything below is a guess, so the floor applies ──────────────────────
  const free = friends.filter(
    f => !f.hideFromMatches && !declaredSet.has(f.id) && hasGreenOverlap(f, startAt, viewerTimezone, now),
  )
  if (free.length === 0) return null

  // ── group fit ──────────────────────────────────────────────────────────────
  // Needs two or more of the same group free in the window; one person free is
  // an individual guess, not a crew.
  const byGroup = new Map<string, number>()
  for (const f of free) for (const g of f.groupIds) byGroup.set(g, (byGroup.get(g) ?? 0) + 1)

  let best: { groupId: string; count: number } | null = null
  for (const [groupId, count] of byGroup) {
    if (count < 2) continue
    if (!groupNames.has(groupId)) continue
    if (!best || count > best.count || (count === best.count && groupId < best.groupId)) {
      best = { groupId, count }
    }
  }
  if (best) {
    return {
      kind: 'groupFit',
      groupId: best.groupId,
      groupName: groupNames.get(best.groupId) as string,
      count: best.count,
    }
  }

  // ── individual computed ────────────────────────────────────────────────────
  // Interest match only RANKS here, it does not gate: the floor was green
  // overlap, and 24.7 puts interest tags last in the weight order on purpose.
  const ranked = [...free].sort((a, b) => {
    const am = category && a.interests.includes(category) ? 1 : 0
    const bm = category && b.interests.includes(category) ? 1 : 0
    if (am !== bm) return bm - am
    return a.id < b.id ? -1 : 1
  })
  return { kind: 'computed', friends: ranked.slice(0, 3).map(strip) }
}

/** How many cards the feed shows, by how busy the viewer's own people are. */
export function feedCardCount(opts: { hasFriends: boolean; anyGreen: boolean; anyPlans: boolean }): number {
  if (!opts.hasFriends) return 2 // cold start, under the invite CTA
  if (opts.anyGreen || opts.anyPlans) return 1 // busy, last position
  return 3 // friends exist but nothing is happening — this is the case it is for
}
