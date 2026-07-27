-- ─────────────────────────────────────────────────────────────────────────────
-- 0003 — ZIP data into Postgres  (STATUS: pending)
-- Removes the `zipcodes` npm package from the request path (it loaded the full
-- US dataset into memory on every cold start). Radius + nearest-centroid lookups
-- now run in the database against an indexed table.
--
-- Run order: apply this file → run `node scripts/seed-zipcodes.mjs` (populates the
-- table) → deploy the P5a code. The code depends on the table being populated.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS cube          WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS earthdistance WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.zip_codes (
  zip   text PRIMARY KEY,
  city  text,
  state text,
  lat   double precision NOT NULL,
  lng   double precision NOT NULL
);

-- GiST index on the earth point → fast radius (@>) and nearest-neighbour (<->) queries.
CREATE INDEX IF NOT EXISTS idx_zip_codes_earth
  ON public.zip_codes USING gist (extensions.ll_to_earth(lat, lng));

-- Reference data, read only by the server (service role). Default-deny.
ALTER TABLE public.zip_codes ENABLE ROW LEVEL SECURITY;

-- ── nearby_zips(): the origin zip + every zip whose centroid is within radius ──
CREATE OR REPLACE FUNCTION public.nearby_zips(p_zip text, p_radius_miles double precision DEFAULT 25)
RETURNS TABLE (zip text)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT z.zip
  FROM public.zip_codes z, public.zip_codes origin
  WHERE origin.zip = p_zip
    AND earth_box(ll_to_earth(origin.lat, origin.lng), p_radius_miles * 1609.34)
        @> ll_to_earth(z.lat, z.lng)
    AND earth_distance(ll_to_earth(origin.lat, origin.lng), ll_to_earth(z.lat, z.lng))
        <= p_radius_miles * 1609.34;
$$;

-- ── nearest_zip(): reverse-geocode a precise point to its nearest centroid ─────
CREATE OR REPLACE FUNCTION public.nearest_zip(p_lat double precision, p_lng double precision)
RETURNS TABLE (zip text, city text, state text)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT z.zip, z.city, z.state
  FROM public.zip_codes z
  ORDER BY ll_to_earth(z.lat, z.lng) <-> ll_to_earth(p_lat, p_lng)
  LIMIT 1;
$$;
