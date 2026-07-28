-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 22 — Scheduled availability
--
-- The first server-side scheduler in this app, and the first time it stores a
-- user's timezone.
--
-- Every local-time computation in Mooves is client-side, and that is
-- architecture rather than accident: 9.5 Part A, 18.1's Mon–Thu rule, and
-- plans.start_at all compute on the mover's own clock because the server does
-- not know their zone. That holds everywhere except here. A job that must fire
-- at 9am LOCAL cannot be client-side, because the client is asleep.
--
-- Scope wall: users.timezone is read by the cron route and NOTHING else. No
-- existing computation moves server-side in this migration.
--
-- ⚠ TWO MANUAL STEPS before anything fires (see the runbook block at the end):
--    1. Two Vault secrets, `app_url` and `cron_secret`.
--    2. CRON_SECRET in the Vercel environment, matching the Vault one.
--   Until both exist the tick runs, finds no secrets, and returns quietly.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Extensions ───────────────────────────────────────────────────────────────
-- pg_cron creates and owns the `cron` schema; pg_net creates and owns `net`.
-- If the CLI cannot create these (role permissions differ by project), enable
-- both from Dashboard → Database → Extensions and re-run — everything below is
-- idempotent.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── users: the timezone, the ritual, and the two idempotency stamps ──────────
ALTER TABLE public.users
  -- IANA zone name ("America/Chicago"), never a UTC offset: offsets are wrong
  -- twice a year and DST then becomes our problem instead of Postgres's.
  -- NULLABLE ON PURPOSE, and that nullability IS the rollout. A user with no
  -- zone is skipped by the scheduler entirely and picks one up silently on
  -- their next app open, so the population fills in with no backfill.
  ADD COLUMN IF NOT EXISTS timezone TEXT,

  -- 0 = Sunday … 6 = Saturday, matching JS getDay(). Default Monday.
  -- Moves BOTH the nudge and the start of the week grid, deliberately: a week
  -- beginning on a different day than the reminder is two settings pretending
  -- to be one.
  ADD COLUMN IF NOT EXISTS week_ritual_day SMALLINT NOT NULL DEFAULT 1,

  -- Opt-out for the weekly nudge only. Mirrors wave_push_enabled. Turning this
  -- off must never disable the ritual itself — see 22.6.
  ADD COLUMN IF NOT EXISTS week_push_enabled BOOLEAN NOT NULL DEFAULT true,

  -- The user's LOCAL date each push last fired on. Written only after a send
  -- succeeds, which is what makes a failed tick retry and a succeeded one never
  -- repeat. Local, not UTC: "once per day" has to mean the user's day.
  ADD COLUMN IF NOT EXISTS last_week_push_on DATE,
  ADD COLUMN IF NOT EXISTS last_confirm_push_on DATE;

DO $$
BEGIN
  ALTER TABLE public.users
    ADD CONSTRAINT users_week_ritual_day_check CHECK (week_ritual_day BETWEEN 0 AND 6);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── availability_slots ───────────────────────────────────────────────────────
--
-- One row per (user, date, part) the user marked. NOT a recurring template:
-- rows are minted fresh each week by the ritual and nothing carries forward. A
-- saved preset drifts out of true silently; a week you set this week cannot.
--
-- PRIVATE. Nothing reads this table on behalf of another user. get_feed and
-- get_plans are deliberately NOT touched by this migration — the best
-- structural consequence of "private until green" is that the two functions
-- which have been silently broken twice stay closed.
--
-- Parts are four values, not three, because the offered set differs by day:
--   weekdays  → day (09:00–17:00), evening (17:00–23:00)
--   weekends  → morning (08:00–12:00), afternoon (12:00–17:00), evening
-- Weekday mornings are not offered at all. 16 cells, 5×2 + 2×3.
CREATE TABLE IF NOT EXISTS public.availability_slots (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  slot_date  DATE        NOT NULL,
  part       TEXT        NOT NULL CHECK (part IN ('morning','day','afternoon','evening')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS availability_slots_uniq
  ON public.availability_slots (user_id, slot_date, part);
CREATE INDEX IF NOT EXISTS availability_slots_user_date_idx
  ON public.availability_slots (user_id, slot_date);
-- The cron's daily scan reads by date across all users.
CREATE INDEX IF NOT EXISTS availability_slots_date_idx
  ON public.availability_slots (slot_date);

-- RLS on, NO policies: service-role only, matching plans and plan_comments.
-- Not added to the realtime publication — a private table nobody subscribes to.
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;

-- ── The clock ────────────────────────────────────────────────────────────────
--
-- pg_cron is the ONLY thing that lives in Postgres. Timezone math, recipient
-- selection and FCM all stay in the route, next to the push pipeline that
-- already exists in src/lib/push.ts. Reimplementing any of that in plpgsql
-- would be the bad path.
--
-- This is the first time the database calls OUT to the app rather than the app
-- reaching in, which inverts the trust direction — hence the shared secret, and
-- hence the route answering 404 rather than 401 when it is wrong.
--
-- The secret is read from Vault at call time and never appears in this file.
-- A secret committed to git is not a secret.
CREATE OR REPLACE FUNCTION public.availability_cron_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, vault
AS $$
DECLARE
  v_url    text;
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_url    FROM vault.decrypted_secrets WHERE name = 'app_url'     LIMIT 1;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1;

  -- Missing secrets is the expected state between this migration landing and
  -- the runbook being followed. Say so and stop; never raise, or the job log
  -- fills with failures for a condition that is simply "not configured yet".
  IF v_url IS NULL OR v_secret IS NULL THEN
    RAISE NOTICE 'availability_cron_tick: vault secrets app_url/cron_secret not set, skipping';
    RETURN;
  END IF;

  -- Fire and forget. pg_net is async by design: the response lands in
  -- net._http_response and nothing here waits on it. The route is idempotent
  -- per user per local day, so a duplicate call is harmless.
  PERFORM net.http_post(
    url     := rtrim(v_url, '/') || '/api/cron/availability',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'x-cron-secret', v_secret
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.availability_cron_tick() FROM PUBLIC, anon, authenticated;

-- Slots older than a week are dead weight. Trivial to purge once a scheduler
-- exists, and it keeps the cron's daily scan reading a table that stays small.
CREATE OR REPLACE FUNCTION public.purge_old_availability_slots()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM public.availability_slots WHERE slot_date < current_date - 7;
$$;

REVOKE ALL ON FUNCTION public.purge_old_availability_slots() FROM PUBLIC, anon, authenticated;

-- ── The two jobs ─────────────────────────────────────────────────────────────
--
-- Every 15 minutes, NOT hourly. "9am local" is only correct at 15-minute
-- granularity because not every zone is a whole hour off UTC: India is +5:30,
-- Nepal +5:45, Chatham +12:45. Hourly would systematically miss them.
--
-- unschedule-then-schedule so re-running this migration is safe; unschedule
-- raises if the job is absent, which on a first run it is.
DO $$
BEGIN
  PERFORM cron.unschedule('availability-tick');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('availability-purge');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'availability-tick',
  '*/15 * * * *',
  $job$ SELECT public.availability_cron_tick() $job$
);

SELECT cron.schedule(
  'availability-purge',
  '15 4 * * *',
  $job$ SELECT public.purge_old_availability_slots() $job$
);

-- ─────────────────────────────────────────────────────────────────────────────
-- RUNBOOK — nothing fires until both of these are done.
--
-- 1. Create the two Vault secrets (Dashboard → Project Settings → Vault, or SQL):
--
--      SELECT vault.create_secret('https://makemooves.app', 'app_url');
--      SELECT vault.create_secret('<a long random string>', 'cron_secret');
--
-- 2. Set CRON_SECRET in the Vercel environment to the SAME random string, and
--    redeploy. The route compares the two and answers 404 on a mismatch.
--
-- To verify:
--      SELECT jobname, schedule, active FROM cron.job;
--      SELECT status, return_message, start_time
--        FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
--
-- To stop the scheduler entirely without dropping anything:
--      UPDATE cron.job SET active = false WHERE jobname LIKE 'availability-%';
-- ─────────────────────────────────────────────────────────────────────────────
