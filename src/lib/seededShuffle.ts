// One seeded shuffle, used by two surfaces that both need "a different order
// every time you open the app, and the SAME order for the rest of the session":
// the rail's grey tail (R21) and the near-you shelf (24.6).
//
// Both need it for the same reason — a list that reorders under the thumb on
// every re-render or every Realtime tick is unusable — so the hash lives here
// rather than being written twice with two different subtle bugs.

/**
 * Stable per (id, seed), and avalanching.
 *
 * The obvious `h = h * 31 + c` is MONOTONIC in the first character when every
 * id starts from the same seed, which in the rail mockup produced a "shuffle"
 * that came out alphabetical and did not move when reseeded. This one mixes.
 */
export function hashSeeded(id: string, seed: number): number {
  let h = (seed ^ 0x9e3779b9) >>> 0
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 0x01000193) >>> 0
  }
  h ^= h >>> 15
  h = Math.imul(h, 0x2545f491) >>> 0
  h ^= h >>> 13
  return h >>> 0
}

/** A fresh seed per app open. Hold it in state — do not call it per render. */
export function newSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0
}

/**
 * Deterministic shuffle. Ties fall back to the id so the same inputs always
 * produce the same order and a re-render cannot move anything on its own.
 */
export function seededShuffle<T>(items: T[], seed: number, idOf: (item: T) => string): T[] {
  return [...items].sort((a, b) => {
    const ka = hashSeeded(idOf(a), seed)
    const kb = hashSeeded(idOf(b), seed)
    if (ka !== kb) return ka - kb
    const ia = idOf(a)
    const ib = idOf(b)
    return ia < ib ? -1 : ia > ib ? 1 : 0
  })
}
