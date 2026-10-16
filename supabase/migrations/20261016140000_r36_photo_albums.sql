-- ─────────────────────────────────────────────────────────────────────────────
-- R36 — Past Mooves + photo albums (photos only)
--
-- ⚠ THIS AMENDS PHASE 21 WALL 4, FOR PHOTO COMMENTS ONLY, IN DAYLIGHT
--   (Jackson, 2026-10-16).
--
-- Wall 4 says comments die with the Moove and there is "never history, never
-- anything to scroll back to". An album you can revisit is history by design,
-- so the amendment is stated here rather than discovered later:
--
--   • plan_photo_comments LIVE AS LONG AS THE PHOTO. They cascade off the photo,
--     which cascades off the plan — never off the plan's expiry.
--   • The Moove's OWN thread (plan_comments) is untouched and still dies at
--     expiry. Past shows the album, never the old thread.
--   • Walls 1–3 hold exactly: only on a Moove (photo_id → plan_photos → plans,
--     NOT NULL all the way down, no green path), only for the author + people
--     holding a move_joins row FOR THIS PLAN (never plan_id IS NULL green rows),
--     and invisible and unhinted to everyone else. Those two live in the API,
--     because this whole surface is service-role only.
--
-- Moderation, amended from the draft: the Moove's creator can remove any photo
-- (and any photo comment). Uploaders delete their own. No reporting, no
-- blocking — the creator-remove is the safety story, accepted knowingly
-- because photos, unlike comments, are permanent.
--
-- Leaving a Moove keeps your photos (the row is keyed to the plan, not to your
-- join) but you lose access, because access is re-derived from move_joins on
-- every request.
--
-- Push cooldowns reuse public.rate_limits via checkRateLimit, exactly like
-- Phase 21's comment pushes. No new cooldown table.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Photos ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plan_photos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id      UUID        NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  uploader_id  UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- `${plan_id}/${uploader_id}/${uuid}.jpg` inside the private plan-photos
  -- bucket. Unique so one uploaded object can only ever be confirmed once.
  storage_path TEXT        NOT NULL UNIQUE,
  width        INT,
  height       INT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The album read: every photo on one Moove, newest first.
CREATE INDEX IF NOT EXISTS plan_photos_plan_idx
  ON public.plan_photos (plan_id, created_at);

-- The cap check: how many has this person added to this Moove (50 max).
CREATE INDEX IF NOT EXISTS plan_photos_plan_uploader_idx
  ON public.plan_photos (plan_id, uploader_id);

ALTER TABLE public.plan_photos ENABLE ROW LEVEL SECURITY;
-- No policies: service-role only, matching plan_comments.

-- The 50-per-person cap, enforced where a race cannot get past it. The API
-- checks the count too, but the client uploads three at a time, so three
-- confirms at 49 could each see 49 and all insert. A per-(plan, uploader)
-- advisory lock serialises them; the third gets check_violation and the API
-- answers 409 and discards the object.
CREATE OR REPLACE FUNCTION public.plan_photos_enforce_cap()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.plan_id::text || ':' || NEW.uploader_id::text));
  IF (SELECT count(*) FROM public.plan_photos
       WHERE plan_id = NEW.plan_id AND uploader_id = NEW.uploader_id) >= 50 THEN
    RAISE EXCEPTION 'photo cap reached' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS plan_photos_cap ON public.plan_photos;
CREATE TRIGGER plan_photos_cap
  BEFORE INSERT ON public.plan_photos
  FOR EACH ROW EXECUTE FUNCTION public.plan_photos_enforce_cap();

-- ── Photo comments ──────────────────────────────────────────────────────────
--
-- A mirror of plan_comments, keyed to a photo instead of a plan. Same 500 cap,
-- same edited_at, same validated-mentions array (roster-bounded, R8).
CREATE TABLE IF NOT EXISTS public.plan_photo_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id   UUID        NOT NULL REFERENCES public.plan_photos(id) ON DELETE CASCADE,
  author_id  UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body       TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  mentions   UUID[]      NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS plan_photo_comments_photo_idx
  ON public.plan_photo_comments (photo_id, created_at);

ALTER TABLE public.plan_photo_comments ENABLE ROW LEVEL SECURITY;

-- ── Photo comment likes ─────────────────────────────────────────────────────
--
-- Same integrity story as plan_comment_likes: the composite PK is the counter.
CREATE TABLE IF NOT EXISTS public.plan_photo_comment_likes (
  comment_id UUID        NOT NULL REFERENCES public.plan_photo_comments(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.users(id)               ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS plan_photo_comment_likes_comment_idx
  ON public.plan_photo_comment_likes (comment_id);

ALTER TABLE public.plan_photo_comment_likes ENABLE ROW LEVEL SECURITY;

-- ⚠ None of the three tables is added to the realtime publication. Albums load
-- when opened and on focus, for the same reason comments do.

-- ── The morning-after nudge stamp ───────────────────────────────────────────
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS photo_nudge_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.plans.photo_nudge_sent_at IS
  'R36: when the once-only "Add your photos from {title}" push went out. '
  'NULL means not yet; the cron stamps it after a successful send.';

-- ── Storage ─────────────────────────────────────────────────────────────────
--
-- PRIVATE. Objects are only ever served through short-lived signed URLs minted
-- by the API after the access check, and written only through signed upload
-- URLs minted the same way. No storage policies: anon and authenticated get
-- nothing. JPEG only, because every upload is re-encoded client-side through a
-- canvas (which is also what strips EXIF and GPS).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('plan-photos', 'plan-photos', false, 10485760, ARRAY['image/jpeg'])
ON CONFLICT (id) DO NOTHING;

-- ── The nudge tick ──────────────────────────────────────────────────────────
--
-- Same shape as availability_cron_tick and community_moves_cron_tick: Postgres
-- calls the app with the shared Vault secrets, and the route answers 404 when
-- the secret is wrong. No new runbook step.
CREATE OR REPLACE FUNCTION public.photo_nudge_cron_tick()
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
    RAISE NOTICE 'photo_nudge_cron_tick: vault secrets not set, skipping';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := rtrim(v_url, '/') || '/api/cron/photo-nudge',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'x-cron-secret', v_secret
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.photo_nudge_cron_tick() FROM PUBLIC, anon, authenticated;

-- Hourly. The route decides who is due (author's local 09:00–10:00, the
-- morning after), so a whole-hour tick lands inside that window once for every
-- zone, half-hour zones included. Offset to :35 to stay clear of :07 and :20.
DO $$
BEGIN
  PERFORM cron.unschedule('photo-nudge-tick');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'photo-nudge-tick',
  '35 * * * *',
  $job$ SELECT public.photo_nudge_cron_tick() $job$
);
