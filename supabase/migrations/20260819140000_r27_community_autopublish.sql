-- R27 — community mooves publish themselves.
--
-- WHAT WENT WRONG. The seeding routine ran every day for fifteen days without a
-- single miss. Rows landed every day. Nobody approved them. On 2026-08-19 the
-- state was: 386 rows pending, 97 of them still in the future, and ZERO approved
-- moves with a future start time in any of the four metros. Every metro dark
-- since 2026-08-11, while the pipeline feeding them was in perfect health.
--
-- The gate existed to stop a model inventing events. It was a good instinct. But
-- an unstaffed gate does not stop bad content, it stops ALL content, and it does
-- it silently — there was no error anywhere, which is why it ran for two weeks.
-- Fifteen days of empty feed is a worse failure than the one the gate prevented.
--
-- SO THE GATE INVERTS. Seeded rows that clear validation now publish on arrival,
-- and the human pass becomes a spot-check AFTER the fact rather than a
-- precondition. `reviewed_at` is what makes that real rather than nominal: it
-- records whether a human has actually looked, so "live" and "checked" stop
-- being the same bit and the admin console can show what is live-but-unlooked-at.
--
-- WHAT DOES NOT CHANGE. Sponsor-authored moves (origin <> 'seeded') keep the
-- real gate. They are paid placements from third parties; the five validation
-- bars in the ingest route say nothing about them, and money is involved. The
-- boundary is `origin`, enforced in the ingest route, which is the only writer
-- that sets 'seeded'.

-- ── reviewed_at ──────────────────────────────────────────────────────────────
ALTER TABLE public.sponsored_moves
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.sponsored_moves.reviewed_at IS
  'R27: when a human last eyeballed this row. NULL on an auto-published seeded '
  'move means live but never checked — that is the admin audit list. Distinct '
  'from status, which is now about visibility rather than about review.';

-- Everything approved BEFORE R27 went through the old human gate by definition,
-- so it is already reviewed. Without this backfill the audit list would open on
-- day one showing every move ever approved.
UPDATE public.sponsored_moves
   SET reviewed_at = created_at
 WHERE status = 'approved'
   AND reviewed_at IS NULL;

-- The audit list: live, never looked at, still upcoming, soonest first. Partial
-- so it stays tiny — it indexes only the rows actually awaiting a glance.
CREATE INDEX IF NOT EXISTS sponsored_moves_unreviewed_idx
  ON public.sponsored_moves (start_at)
  WHERE status = 'approved' AND reviewed_at IS NULL;

-- The freshness alarm counts live upcoming rows per metro on every tick.
CREATE INDEX IF NOT EXISTS sponsored_moves_metro_live_idx
  ON public.sponsored_moves (metro_id, start_at)
  WHERE status = 'approved';

-- ── The alarm's memory ───────────────────────────────────────────────────────
--
-- The alarm ticks hourly but must not mail hourly. This stamp is what turns a
-- level check into an edge: set when a metro is first reported thin, refreshed
-- once a day while it stays thin, and CLEARED the moment it recovers — so a
-- metro that goes thin, recovers, and goes thin again alerts both times rather
-- than being suppressed by a stamp from last week.
ALTER TABLE public.metros
  ADD COLUMN IF NOT EXISTS thin_alerted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.metros.thin_alerted_at IS
  'R27: last time the freshness alarm reported this metro as thin on upcoming '
  'community moves. NULL means healthy — cleared on recovery, not on send.';

-- ── The tick ─────────────────────────────────────────────────────────────────
--
-- Same shape as availability_cron_tick (Phase 22): Postgres calls the app, so
-- the secret comes from Vault and never appears in this file, and the route
-- answers 404 rather than 401 when it is wrong.
--
-- It reuses the SAME `cron_secret` and `app_url` secrets Phase 22 established,
-- so there is no new runbook step. If Phase 22's runbook was followed, this
-- works the moment the migration lands.
CREATE OR REPLACE FUNCTION public.community_moves_cron_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, vault
AS $fn$
DECLARE
  v_url    text;
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_url    FROM vault.decrypted_secrets WHERE name = 'app_url'     LIMIT 1;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1;

  IF v_url IS NULL OR v_secret IS NULL THEN
    RAISE NOTICE 'community_moves_cron_tick: vault secrets not set, skipping';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := rtrim(v_url, '/') || '/api/cron/community-moves',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'x-cron-secret', v_secret
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.community_moves_cron_tick() FROM PUBLIC, anon, authenticated;

-- Hourly, not daily. The alarm's whole job is to catch a metro going dark, and
-- a daily alarm can be up to 24 hours late in noticing — which is most of the
-- way to how this failure went unseen for a fortnight in the first place.
-- Offset to :20 so it does not contend with the seeding routine at :07.
DO $$
BEGIN
  PERFORM cron.unschedule('community-moves-tick');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'community-moves-tick',
  '20 * * * *',
  $job$ SELECT public.community_moves_cron_tick() $job$
);
