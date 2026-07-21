// Phase 13 — the fixed, curated interest taxonomy (13.1). Shared client + server.
// Stored on users.interests (slug[]) and sponsored_moves.category (single slug).

export interface Interest {
  slug: string
  label: string
}

export const INTERESTS: Interest[] = [
  { slug: 'running_fitness', label: 'Running & fitness' },
  { slug: 'pickup_sports', label: 'Pickup sports' },
  { slug: 'outdoors', label: 'Outdoors & adventure' },
  { slug: 'wellness', label: 'Wellness' },
  { slug: 'nightlife', label: 'Nightlife' },
  { slug: 'live_music', label: 'Live music' },
  { slug: 'comedy_shows', label: 'Comedy & shows' },
  { slug: 'games_trivia', label: 'Games & trivia' },
  { slug: 'food_drink', label: 'Food & drink' },
  { slug: 'coffee_cafes', label: 'Coffee & cafés' },
  { slug: 'markets_popups', label: 'Markets & pop-ups' },
  { slug: 'arts_culture', label: 'Arts & culture' },
  { slug: 'festivals', label: 'Festivals & seasonal' },
  { slug: 'community', label: 'Community' },
]

export const INTEREST_SLUGS: string[] = INTERESTS.map(i => i.slug)

export function interestLabel(slug: string): string {
  return INTERESTS.find(i => i.slug === slug)?.label ?? slug
}

export function isInterestSlug(value: string): boolean {
  return INTEREST_SLUGS.includes(value)
}
