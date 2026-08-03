-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 24, pass 1 — metros, and the fields the Mooves feed needs.
--
-- Schema only. No function is redefined here, deliberately: get_feed and
-- get_plans have each been silently broken by a CREATE OR REPLACE before (the
-- 0008 expiry regression, then the get_plans edit bug), and nothing in this
-- pass needs either of them. The read-path changes land in pass 2, against a
-- schema that is already live and verified.
--
-- WHY METROS AT ALL. Phase 12 stores users.area_zip and matches by a 25-mile
-- radius (nearby_zips), which is the right unit for "what is near this person".
-- It is the wrong unit for the 24.9 seeding job: 60647 and 60622 are two miles
-- apart, share essentially the same inventory, and pulling per-zip would mean
-- N× redundant LLM work and near-duplicate rows. The job iterates metros, of
-- which there are tens; the feed keeps reading by radius, of which there are
-- thousands. Both units coexist on purpose.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── metros ───────────────────────────────────────────────────────────────────
-- lat/lng as double precision rather than a PostGIS type, matching zip_codes:
-- this database has cube + earthdistance, not PostGIS, and ll_to_earth already
-- indexes fine against plain columns.
CREATE TABLE IF NOT EXISTS public.metros (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL,
  state                text NOT NULL,
  lat                  double precision NOT NULL,
  lng                  double precision NOT NULL,
  -- How far out this metro reaches when its zip set is seeded. Deliberately
  -- wider than the feed's 25-mile AREA_RADIUS_MILES: a metro is the unit an
  -- events pull covers, not the unit a person browses.
  radius_miles         double precision NOT NULL DEFAULT 30,
  -- 24.9: staleness has to be visible without alerting infrastructure. If a
  -- metro stops pulling, this stops moving and the admin console shows it.
  last_successful_pull timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_metros_name_state
  ON public.metros (lower(name), lower(state));

COMMENT ON TABLE  public.metros IS
  'Phase 24.9: the unit the daily events pull iterates. Tens of rows, not thousands. The feed still matches by zip radius.';
COMMENT ON COLUMN public.metros.radius_miles IS
  'How far out metro_zips is seeded. Wider than the feed radius on purpose.';
COMMENT ON COLUMN public.metros.last_successful_pull IS
  '24.9: last time the ingest route accepted rows for this metro. NULL means never pulled.';


-- ── metro_zips ───────────────────────────────────────────────────────────────
-- A zip belongs to exactly one metro, so zip is the primary key. Populated by
-- radius from the metro centroid against the existing GiST index on zip_codes
-- (same shape as nearby_zips), not by hand-listing zips.
CREATE TABLE IF NOT EXISTS public.metro_zips (
  zip      text PRIMARY KEY REFERENCES public.zip_codes(zip) ON DELETE CASCADE,
  metro_id uuid NOT NULL REFERENCES public.metros(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_metro_zips_metro ON public.metro_zips (metro_id);

COMMENT ON TABLE public.metro_zips IS
  'Phase 24.9: zip → metro. Seeded by radius from metros.lat/lng; a zip maps to one metro.';


-- ── users ────────────────────────────────────────────────────────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS activated_at         timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS hide_from_matches    boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS recruit_ask_shown_at timestamptz;

COMMENT ON COLUMN public.users.activated_at IS
  '24.4: first RECIPROCAL event — someone joined their green/Moove, or they joined someone''s. Set once, never cleared. Invites sent is explicitly not the metric.';
COMMENT ON COLUMN public.users.hide_from_matches IS
  '24.0 wall 4: opts the user out of every computed "would probably go" line, everywhere, immediately.';
COMMENT ON COLUMN public.users.recruit_ask_shown_at IS
  '24.3: the one recruit ask fires at most once per user. Set on display, never cleared, and nothing persists after dismissal.';


-- ── sponsored_moves ──────────────────────────────────────────────────────────
ALTER TABLE public.sponsored_moves ADD COLUMN IF NOT EXISTS metro_id     uuid REFERENCES public.metros(id) ON DELETE SET NULL;
ALTER TABLE public.sponsored_moves ADD COLUMN IF NOT EXISTS origin       text;
ALTER TABLE public.sponsored_moves ADD COLUMN IF NOT EXISTS source_url   text;
ALTER TABLE public.sponsored_moves ADD COLUMN IF NOT EXISTS dedupe_key   text;
ALTER TABLE public.sponsored_moves ADD COLUMN IF NOT EXISTS price_text   text;
ALTER TABLE public.sponsored_moves ADD COLUMN IF NOT EXISTS is_free      boolean;
ALTER TABLE public.sponsored_moves ADD COLUMN IF NOT EXISTS neighborhood text;

CREATE INDEX IF NOT EXISTS idx_sponsored_moves_metro ON public.sponsored_moves (metro_id);

-- Backfill BEFORE the CHECK, or the constraint fails on every existing row.
-- sponsor_id IS NULL currently means "Mooves authored this by hand", which is
-- what 'house' names. Nothing existing is 'seeded' — that origin starts empty
-- and only the 24.9 ingest route ever writes it.
UPDATE public.sponsored_moves
   SET origin = CASE WHEN sponsor_id IS NULL THEN 'house' ELSE 'sponsor' END
 WHERE origin IS NULL;

ALTER TABLE public.sponsored_moves ALTER COLUMN origin SET DEFAULT 'sponsor';
ALTER TABLE public.sponsored_moves ALTER COLUMN origin SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sponsored_moves_origin_check'
  ) THEN
    ALTER TABLE public.sponsored_moves
      ADD CONSTRAINT sponsored_moves_origin_check
      CHECK (origin IN ('sponsor', 'seeded', 'house'));
  END IF;
END $$;

-- Fuzzy identity for the 24.9 dedupe: normalized title + venue + start time,
-- computed by the ingest route, not here. UNIQUE permits many NULLs in
-- Postgres, so every pre-existing row and every sponsor-authored row coexists
-- untouched; only seeded rows carry a key.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sponsored_moves_dedupe_key_key'
  ) THEN
    ALTER TABLE public.sponsored_moves
      ADD CONSTRAINT sponsored_moves_dedupe_key_key UNIQUE (dedupe_key);
  END IF;
END $$;

COMMENT ON COLUMN public.sponsored_moves.origin IS
  '24.9: sponsor = paid placement · seeded = pulled by the events routine · house = Mooves authored by hand. Drives the card label (Sponsored vs Community Moove) and whether a link-out is offered.';
COMMENT ON COLUMN public.sponsored_moves.source_url IS
  '24.9 quality gate: the page that actually lists this event. Rows without one are rejected before reaching the review queue.';
COMMENT ON COLUMN public.sponsored_moves.dedupe_key IS
  '24.9: normalized title + venue + start_at. UNIQUE, and NULL for everything the ingest route did not create.';
-- ⚠ NOT price_cents. price_cents is what the SPONSOR pays Mooves for placement
-- (Phase 13.6). price_text is what the ATTENDEE pays at the door, and it is the
-- one the card renders. The two live side by side and mean opposite things.
COMMENT ON COLUMN public.sponsored_moves.price_text IS
  '24.7: attendee-facing cost as displayed ("Free", "$10", "$$"). NOT price_cents, which is the sponsor''s placement fee.';
-- Nullable on purpose. NOT NULL DEFAULT false would assert that every row
-- already in the table costs money, which is a claim we cannot make. NULL is
-- "unknown" and the Free filter matches IS TRUE only.
COMMENT ON COLUMN public.sponsored_moves.is_free IS
  '24.8 Free filter. NULL = unknown, not false. Filter matches IS TRUE.';
-- location_text is the venue ("Emporium, 2363 N Milwaukee"); this is the
-- neighbourhood the card shows ("Logan Square"). Different granularity, both
-- rendered, in different places.
COMMENT ON COLUMN public.sponsored_moves.neighborhood IS
  '24.7: neighbourhood shown on the card. location_text stays the venue, shown in the detail sheet.';


-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Enabled with NO policies, matching sponsored_moves, move_interested and
-- zip_codes: default-deny to anon and authenticated, service client bypasses.
-- Both tables are read by the server only.
ALTER TABLE public.metros     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metro_zips ENABLE ROW LEVEL SECURITY;
