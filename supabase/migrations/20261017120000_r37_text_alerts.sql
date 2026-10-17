-- ─────────────────────────────────────────────────────────────────────────────
-- R37 — Text alerts
--
-- A text when a DIRECT friend makes a Moove you can see, with a link back into
-- it. Ships dark: nothing is queued or sent until SMS_ALERTS_ENABLED=true is
-- set in Vercel, which waits on Twilio toll-free verification.
--
-- The four users columns ARE the consent record, and they are what a carrier
-- or Twilio audit would ask for:
--   • sms_alerts_opt_in_at  when they checked the box and tapped the button
--   • sms_consent_version   which disclosure text they agreed to
--                           (SMS_CONSENT_VERSION in src/lib/sms.ts; the literal
--                           'start-keyword' when they joined by texting START
--                           without ever opting in on a screen)
--   • sms_opted_out_at      set on STOP or Settings → Turn off; cleared on opt-in
--   • sms_opted_out_via     'settings' | 'stop' — Settings words the stopped
--                           state differently when the person replied STOP
--
-- Opted in  = sms_alerts_opt_in_at IS NOT NULL AND sms_opted_out_at IS NULL.
--
-- sms_outbox is one row per (recipient, Moove), ever — the unique key is what
-- makes a retried create unable to text anyone twice. It drives:
--   • the overnight hold  status 'queued', due_at = recipient-local 08:00
--   • the digest          the cron sends every due row for a person as ONE text
--   • the cancel-drop     queued rows whose Moove is gone become 'dropped'
--   • the cap             5 texts per person per local day, digest included
--
-- The cap counts TEXTS, not rows. A digest marks all its rows 'sent' with one
-- shared sent_at (one statement, one now()), so count(DISTINCT sent_at) is the
-- number of texts. sms_claim() does that count and the marking under a
-- per-recipient advisory lock, so two Mooves created at once cannot both see
-- "4 sent" and both send the fifth-and-sixth.
--
-- Service-role only: RLS on, no policies, same as plan_comments.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Consent record ───────────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS sms_alerts_opt_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sms_consent_version  TEXT,
  ADD COLUMN IF NOT EXISTS sms_opted_out_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sms_opted_out_via    TEXT
    CHECK (sms_opted_out_via IN ('settings', 'stop'));

COMMENT ON COLUMN public.users.sms_alerts_opt_in_at IS
  'R37: when the person opted in to text alerts. NULL = never.';
COMMENT ON COLUMN public.users.sms_consent_version IS
  'R37: the disclosure version agreed to (SMS_CONSENT_VERSION), or start-keyword.';
COMMENT ON COLUMN public.users.sms_opted_out_at IS
  'R37: set by STOP or Settings → Turn off; cleared on opt-in. Wins over opt_in_at.';
COMMENT ON COLUMN public.users.sms_opted_out_via IS
  'R37: settings | stop.';

-- ── Outbox ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sms_outbox (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id    UUID        NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  due_at     TIMESTAMPTZ NOT NULL,
  sent_at    TIMESTAMPTZ,
  status     TEXT        NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'dropped', 'capped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, plan_id)
);

-- The cron's scan: everything queued and due.
CREATE INDEX IF NOT EXISTS sms_outbox_status_due_idx
  ON public.sms_outbox (status, due_at);

-- The cap count: this person's sent texts since local midnight.
CREATE INDEX IF NOT EXISTS sms_outbox_user_sent_idx
  ON public.sms_outbox (user_id, sent_at)
  WHERE status = 'sent';

ALTER TABLE public.sms_outbox ENABLE ROW LEVEL SECURITY;
-- No policies: service-role only.

-- ── The cap, atomically ──────────────────────────────────────────────────────
--
-- Claim a send for `p_row_ids` (all the same recipient). Under a per-recipient
-- transaction lock: if fewer than p_cap texts went out since p_day_start, mark
-- the rows 'sent' with one shared sent_at and return it — the caller then
-- actually sends. Otherwise mark them 'capped' and return NULL.
--
-- Only rows still 'queued' are touched, so a row the cron already handled can
-- never be claimed twice. If the real send then fails, the caller sets the rows
-- to 'dropped', which hands the slot back (only 'sent' rows count).
CREATE OR REPLACE FUNCTION public.sms_claim(
  p_user      UUID,
  p_row_ids   UUID[],
  p_day_start TIMESTAMPTZ,
  p_cap       INT
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_sent INT;
  v_now  TIMESTAMPTZ := now();
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('sms_claim:' || p_user::text, 0));

  SELECT count(DISTINCT sent_at) INTO v_sent
  FROM public.sms_outbox
  WHERE user_id = p_user
    AND status = 'sent'
    AND sent_at >= p_day_start;

  IF v_sent >= p_cap THEN
    UPDATE public.sms_outbox
       SET status = 'capped'
     WHERE id = ANY(p_row_ids) AND user_id = p_user AND status = 'queued';
    RETURN NULL;
  END IF;

  UPDATE public.sms_outbox
     SET status = 'sent', sent_at = v_now
   WHERE id = ANY(p_row_ids) AND user_id = p_user AND status = 'queued';

  IF NOT FOUND THEN
    RETURN NULL; -- nothing left to claim (already handled elsewhere)
  END IF;

  RETURN v_now;
END;
$fn$;

REVOKE ALL ON FUNCTION public.sms_claim(UUID, UUID[], TIMESTAMPTZ, INT) FROM PUBLIC, anon, authenticated;

-- ── The digest tick ──────────────────────────────────────────────────────────
--
-- Same shape as photo_nudge_cron_tick: Postgres calls the app with the shared
-- Vault secrets, and the route answers 404 when the secret is wrong. No new
-- runbook step.
CREATE OR REPLACE FUNCTION public.sms_digest_cron_tick()
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
    RAISE NOTICE 'sms_digest_cron_tick: vault secrets not set, skipping';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := rtrim(v_url, '/') || '/api/cron/sms-digest',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'x-cron-secret', v_secret
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.sms_digest_cron_tick() FROM PUBLIC, anon, authenticated;

-- Hourly, at :01. Held rows are due at recipient-local 08:00, so a tick just
-- after the hour sends whole-hour zones at 08:01 and half-hour zones at 08:31.
-- Clear of the quarter-hour availability tick, :20 (community) and :35
-- (photo nudge).
DO $$
BEGIN
  PERFORM cron.unschedule('sms-digest-tick');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'sms-digest-tick',
  '1 * * * *',
  $job$ SELECT public.sms_digest_cron_tick() $job$
);
