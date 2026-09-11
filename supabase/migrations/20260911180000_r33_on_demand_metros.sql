-- R33 — metros create themselves, and the pull queue only hands out what is due.
--
-- THE PROBLEM THIS FIXES. `metros` was populated by running scripts/seed-metros.mjs
-- by hand. It was last run on 2026-08-03 and not again until 2026-09-11, so every
-- user who set an area in between — Princeton TX, Hailey ID — sat in an uncovered
-- zip with a permanently empty Discover feed. Nothing errored. `last_successful_pull`
-- was green for all four existing metros the entire time, because the four that
-- existed were fine; the failure was in the metros that did not exist at all, and
-- no timestamp can be stale for a row nobody inserted.
--
-- This is the same shape as the R27 outage: a pipeline with a manual step in it,
-- measuring its throughput rather than its coverage. The fix is the same shape
-- too — delete the manual step.
--
-- WHY NOT PRE-SEED EVERY US METRO. /api/ingest/metros hands the seeding routine
-- every row in this table, and each one costs a web search plus a write on every
-- run. There are 31,575 distinct city/state pairs in zip_codes; even trimmed to
-- the ~380 MSAs that is ~95x the current daily spend to serve, at present, eleven
-- people. Coverage should cost what the users cost, so metros are created when
-- somebody actually stands in one.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── metros.last_attempted_pull ───────────────────────────────────────────────
-- `last_successful_pull` only moves when the ingest route accepts a POST. That
-- is the right signal for "is this metro alive", and the wrong one for "should I
-- hand it out again": a routine that GETs the work list and then dies never
-- stamps it, so the metro stays due and gets handed out every single run. That
-- was survivable at once-a-day. At hourly it is 24x the searches for the one
-- metro that is already failing.
--
-- So: handing a metro out stamps this, completing the pull stamps the other, and
-- due-ness reads both. A crashed run retries after RETRY_AFTER rather than
-- immediately, and a metro cannot be claimed twice in the same hour.
ALTER TABLE public.metros ADD COLUMN IF NOT EXISTS last_attempted_pull timestamptz;

COMMENT ON COLUMN public.metros.last_attempted_pull IS
  'R33: when /api/ingest/metros last handed this metro to the routine. Pairs with last_successful_pull — attempted without successful means the run died mid-flight.';


-- ── ensure_metro_for_zip() ───────────────────────────────────────────────────
-- Everything /api/users/area needs to cover a new zip, in ONE round trip.
--
-- WHY A FUNCTION AND NOT CLIENT-SIDE INSERTS. seed-metros.mjs does this over
-- PostgREST as one POST of up to 809 rows, and on 2026-09-11 that POST returned
-- a 504 partway through the metro list. It happened to be harmless — the batch
-- was entirely duplicates — but the same timeout one metro earlier would have
-- left Princeton and Hailey in `metros` with zero rows in `metro_zips`, which
-- /api/ingest/community-moves rejects with a 409 forever. On the request path,
-- with a user waiting, that failure mode is not acceptable: a half-created metro
-- is worse than no metro, because no metro is at least visibly uncovered.
--
-- Here the insert, the zip claim and the early-out are one statement in one
-- transaction. It either happens or it does not.
--
-- IDEMPOTENT. Safe to call on every area write, which is exactly how it is used
-- — the common case is "this zip is already covered", which costs one indexed
-- lookup on the metro_zips primary key and returns.
CREATE OR REPLACE FUNCTION public.ensure_metro_for_zip(p_zip text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metro_id uuid;
  v_city     text;
  v_state    text;
  v_lat      double precision;
  v_lng      double precision;
  v_radius   double precision;
BEGIN
  -- Already covered. The overwhelmingly common path.
  SELECT metro_id INTO v_metro_id FROM public.metro_zips WHERE zip = p_zip;
  IF v_metro_id IS NOT NULL THEN
    RETURN v_metro_id;
  END IF;

  -- Not a real US zip. The caller has already validated against zip_codes, so
  -- this is belt-and-braces rather than an expected branch.
  SELECT city, state, lat, lng INTO v_city, v_state, v_lat, v_lng
    FROM public.zip_codes WHERE zip = p_zip;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- City + state is a metro's identity (idx_metros_name_state). A second zip in
  -- a city that already has a metro joins it rather than forking a rival.
  SELECT id, radius_miles INTO v_metro_id, v_radius
    FROM public.metros
   WHERE lower(name) = lower(v_city) AND lower(state) = lower(v_state);

  IF v_metro_id IS NULL THEN
    v_radius := 30;
    INSERT INTO public.metros (name, state, lat, lng, radius_miles)
    VALUES (v_city, v_state, v_lat, v_lng, v_radius)
    ON CONFLICT (lower(name), lower(state)) DO NOTHING
    RETURNING id INTO v_metro_id;

    -- Lost the race to a concurrent signup in the same city. Take theirs.
    IF v_metro_id IS NULL THEN
      SELECT id, radius_miles INTO v_metro_id, v_radius
        FROM public.metros
       WHERE lower(name) = lower(v_city) AND lower(state) = lower(v_state);
    END IF;
  END IF;

  -- Claim the neighbourhood. `DO NOTHING` because metro_zips.zip is the primary
  -- key and membership is exclusive: a zip an established metro already owns
  -- stays where it is, which is what stops two adjacent metros tearing a shared
  -- suburb back and forth on every signup.
  INSERT INTO public.metro_zips (zip, metro_id)
  SELECT n.zip, v_metro_id FROM public.nearby_zips(p_zip, v_radius) n
  ON CONFLICT (zip) DO NOTHING;

  RETURN v_metro_id;
END;
$$;

-- Service role only. This writes to two tables that no end user should be able
-- to reach; /api/users/area calls it with the service client after it has already
-- authenticated the caller and validated the zip.
REVOKE ALL ON FUNCTION public.ensure_metro_for_zip(text) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.ensure_metro_for_zip(text) IS
  'R33: create the metro covering this zip (and claim its radius) if nothing covers it yet. Idempotent; returns the covering metro id, or NULL if the zip is not a US zip.';


-- ── backfill ─────────────────────────────────────────────────────────────────
-- Every zip a user already sits in, covered now rather than on their next area
-- write — which for a user who set their area in July may be never.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT u.area_zip
      FROM public.users u
     WHERE u.area_zip IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.metro_zips mz WHERE mz.zip = u.area_zip)
  LOOP
    PERFORM public.ensure_metro_for_zip(r.area_zip);
  END LOOP;
END;
$$;
