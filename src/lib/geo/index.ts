// Coarse-area geo helpers (Phase 12 substrate; Phase 5a: DB-backed).
// Server-only — these take a service-role Supabase client and query the
// public.zip_codes table + nearby_zips/nearest_zip RPCs (migration 0003).
// No third-party geocoding API is ever called; precise coordinates never leave
// our server (coarsenToZip resolves the nearest centroid in the database and
// only the coarse zip is returned).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DB = SupabaseClient<Database>

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

/**
 * Reverse-geocode a precise point to its nearest US zip centroid (nearest_zip RPC).
 * The lat/lng are used only for this database comparison and are never persisted
 * or logged — only the returned coarse area is ever stored.
 */
export async function coarsenToZip(db: DB, lat: number, lng: number): Promise<CoarseArea | null> {
  const { data } = await db.rpc('nearest_zip', { p_lat: lat, p_lng: lng })
  const row = data?.[0]
  return row ? { zip: row.zip, city: row.city ?? '', state: row.state ?? '' } : null
}

/** Validate + label a US zip. Returns null if it isn't a real US zip. */
export async function lookupZip(db: DB, zip: string): Promise<CoarseArea | null> {
  const { data } = await db
    .from('zip_codes')
    .select('zip, city, state')
    .eq('zip', zip)
    .maybeSingle()
  return data ? { zip: data.zip, city: data.city ?? '', state: data.state ?? '' } : null
}

/**
 * The user's area (12.2 matching): their zip plus every zip whose centroid is
 * within `radiusMiles`. Always includes the zip itself (distance 0). Coarse-only.
 */
export async function nearbyZips(
  db: DB,
  zip: string,
  radiusMiles: number = AREA_RADIUS_MILES,
): Promise<string[]> {
  const { data } = await db.rpc('nearby_zips', { p_zip: zip, p_radius_miles: radiusMiles })
  const zips = (data ?? []).map(r => r.zip)
  return zips.includes(zip) ? zips : [zip, ...zips]
}

/**
 * Resolve a stored coarse area into the full area match (label + nearby zips).
 * Returns null if the stored zip is unknown.
 */
export async function resolveArea(
  db: DB,
  zip: string,
  radiusMiles: number = AREA_RADIUS_MILES,
): Promise<AreaMatch | null> {
  const base = await lookupZip(db, zip)
  if (!base) return null
  return { ...base, nearbyZips: await nearbyZips(db, zip, radiusMiles) }
}
