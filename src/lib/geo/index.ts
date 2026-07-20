// Coarse-area geo helpers (Phase 12 substrate). Server-only — never import
// into a client component (it pulls in the full US zip dataset).
//
// Data source: the `zipcodes` npm package (MIT), which bundles US zip centroids
// (zip, lat/lng, city, state). We do all matching in-house; no third-party
// geocoding API is ever called, so precise coordinates never leave our server.

import * as zipcodes from 'zipcodes'

/** Default "my area" radius. One tunable constant — bump it to widen matching. */
export const AREA_RADIUS_MILES = 25

export interface CoarseArea {
  zip: string
  city: string
  state: string
}

export interface AreaMatch extends CoarseArea {
  /** The user's zip plus every zip whose centroid is within the radius. */
  nearbyZips: string[]
}

const EARTH_RADIUS_MILES = 3958.8

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_MILES * 2 * Math.asin(Math.sqrt(a))
}

/**
 * Reverse-geocode a precise point to its nearest US zip centroid.
 * The lat/lng passed here are used only for this in-memory comparison and are
 * never persisted or logged — only the returned coarse area is ever stored.
 */
export function coarsenToZip(lat: number, lng: number): CoarseArea | null {
  let best: CoarseArea | null = null
  let bestDist = Infinity
  for (const rec of Object.values(zipcodes.codes)) {
    if (!rec || rec.latitude == null || rec.longitude == null) continue
    const d = haversineMiles(lat, lng, rec.latitude, rec.longitude)
    if (d < bestDist) {
      bestDist = d
      best = { zip: rec.zip, city: rec.city, state: rec.state }
    }
  }
  return best
}

/** Validate + label a manually entered US zip. Returns null if it isn't a real US zip. */
export function lookupZip(zip: string): CoarseArea | null {
  const rec = zipcodes.lookup(zip)
  if (!rec || rec.latitude == null) return null
  return { zip: rec.zip, city: rec.city, state: rec.state }
}

/**
 * The user's area (12.2 matching): their zip plus every zip whose centroid is
 * within `radiusMiles`. Always includes the zip itself. Coarse-only — no
 * precise coordinates involved.
 */
export function nearbyZips(zip: string, radiusMiles: number = AREA_RADIUS_MILES): string[] {
  const list = zipcodes.radius(zip, radiusMiles)
  return list.includes(zip) ? list : [zip, ...list]
}

/**
 * Resolve a stored coarse area into the full area match (label + nearby zips).
 * This is the entry point Phase 13 will call to filter local moves. Returns
 * null if the stored zip is unknown.
 */
export function resolveArea(zip: string, radiusMiles: number = AREA_RADIUS_MILES): AreaMatch | null {
  const base = lookupZip(zip)
  if (!base) return null
  return { ...base, nearbyZips: nearbyZips(zip, radiusMiles) }
}
