// R21 — the rail's ordering rule, as pure logic.
//
// You first, then everyone who is green, then everyone else. It lives here
// rather than inside the component because the second and third tiers have
// rules that are easy to state and easy to get subtly wrong, and because a
// pure function can be checked without a browser.

export interface RailPerson {
  id: string
  displayName: string | null
  avatarUrl: string | null
  /**
   * Green is a boolean of its own, NOT `statusTime !== null`. A green with no
   * time chip is a real green that counts as `now` — the same rule
   * wave_group_for_viewer uses — so the chip cannot carry the state.
   */
  isGreen: boolean
  statusTime: string | null
  /** ms since epoch the green was set. Breaks ties inside a bucket; null sorts last. */
  greenSince: number | null
  isMe?: boolean
}

import { hashSeeded, newSeed } from './seededShuffle'

const ORDER: Record<string, number> = { now: 0, tonight: 1, week: 2, weekend: 3 }

export const LABEL: Record<string, string> = {
  now: 'Now',
  tonight: 'Tonight',
  week: 'This wk',
  weekend: 'Wknd',
}

/** A green with no chip counts as `now`. */
export function bucketOf(statusTime: string | null): string {
  return statusTime && statusTime in ORDER ? statusTime : 'now'
}

/**
 * A new seed per app open. The grey tail is shuffled, but it must not reshuffle
 * underneath the user's thumb every time a green lands over Realtime, so the
 * seed is generated once and held for the life of the screen.
 *
 * The SAME seed also picks which near-you Mooves the feed shows (24.6), so both
 * shelves turn over together on an app open and neither moves during a session.
 */
export const railSeed = newSeed

/**
 * You → greens (bucket, then most recently gone green) → greys (seeded shuffle).
 *
 * Deliberately total and deterministic: ties fall back to id so the same inputs
 * always render the same order, and a re-render caused by anything other than a
 * change in who is green cannot move a single face.
 */
export function sortRail(people: RailPerson[], seed: number): RailPerson[] {
  const me = people.filter(p => p.isMe)
  const greens = people
    .filter(p => !p.isMe && p.isGreen)
    .sort((a, b) => {
      const bucket = ORDER[bucketOf(a.statusTime)] - ORDER[bucketOf(b.statusTime)]
      if (bucket !== 0) return bucket
      // Newest first. A green with no timestamp sorts after ones that have it.
      const at = a.greenSince ?? -Infinity
      const bt = b.greenSince ?? -Infinity
      if (at !== bt) return bt - at
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
  const greys = people
    .filter(p => !p.isMe && !p.isGreen)
    .sort((a, b) => {
      const ka = hashSeeded(a.id, seed)
      const kb = hashSeeded(b.id, seed)
      if (ka !== kb) return ka - kb
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
  return [...me, ...greens, ...greys]
}
