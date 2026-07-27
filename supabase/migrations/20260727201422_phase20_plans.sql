-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 20 — Planned Mooves
--
-- Adds the `plans` object and teaches move_joins to carry plan joins alongside
-- green joins. Rail is people, feed is Mooves.
--
-- A Moove has a day, a green does not: start_at is required, has_time says
-- whether the author actually picked a clock time or only a date.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.plans (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),

  -- Computed client-side from the author's local date/time, same architecture as
  -- green expiry (9.5 Part A): the server does not know the author's timezone,
  -- so it only sanity-bounds what it is handed. Storing timezones is Phase 22.
  start_at      TIMESTAMPTZ NOT NULL,
  has_time      BOOLEAN     NOT NULL DEFAULT true,
  -- Time set  → start_at + 3h (mirrors the Discover grace period).
  -- Date only → end of that local day.
  expires_at    TIMESTAMPTZ NOT NULL,

  location_text TEXT        CHECK (char_length(location_text) <= 80),
  note          TEXT        CHECK (char_length(note) <= 200),
  visible_to    UUID[],     -- NULL = everyone, same scoping rule as greens

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS plans_author_idx ON public.plans (author_id);
CREATE INDEX IF NOT EXISTS plans_live_idx   ON public.plans (start_at) WHERE cancelled_at IS NULL;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
-- No policies: service-role only. Plans are not realtime-subscribed — they are
-- future-dated and change rarely, and the feed already refetches on move_joins
-- events and on focus.

-- ── move_joins learns about plans ────────────────────────────────────────────
--
-- ⚠ THE RISKY PART OF THIS MIGRATION, on a live table that IS in the realtime
-- publication.
--
-- move_joins was keyed (mover_id, joiner_id) because there is exactly one green
-- per user. Plans are many-per-user, so a plan join needs a plan id, and the old
-- composite PK cannot hold.
--
-- We CANNOT simply drop that PK: move_joins has REPLICA IDENTITY DEFAULT, which
-- means logical replication identifies rows BY THE PRIMARY KEY. Dropping it with
-- nothing to replace it would silently break realtime UPDATE/DELETE delivery for
-- the feed. So a surrogate id becomes the PK, and the two uniqueness rules move
-- to partial indexes.
--
-- mover_id stays NOT NULL and holds the PLAN'S AUTHOR for plan joins, which is
-- why every existing move_joins query must now filter `plan_id IS NULL`.
ALTER TABLE public.move_joins ADD COLUMN IF NOT EXISTS id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.move_joins ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.plans(id) ON DELETE CASCADE;

ALTER TABLE public.move_joins DROP CONSTRAINT IF EXISTS move_joins_pkey;
ALTER TABLE public.move_joins ADD  CONSTRAINT move_joins_pkey PRIMARY KEY (id);

-- One green join per (mover, joiner); one plan join per (plan, joiner).
CREATE UNIQUE INDEX IF NOT EXISTS move_joins_green_uniq
  ON public.move_joins (mover_id, joiner_id) WHERE plan_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS move_joins_plan_uniq
  ON public.move_joins (plan_id, joiner_id)  WHERE plan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS move_joins_plan_idx ON public.move_joins (plan_id) WHERE plan_id IS NOT NULL;

-- ── get_feed: one line changes ───────────────────────────────────────────────
--
-- ⚠ This is the FIFTH definition of get_feed. Reproduced verbatim from
-- 20260727183000 (the owner-visibility fix) with exactly ONE addition: the
-- `plan_id IS NULL` filter in the joins CTE. Without it, plan joins would appear
-- in green joiner lists, because mover_id is populated for both.
--
-- It MUST keep the status_expires_at filter (0008 dropped it by rebuilding from
-- an older body and expired greens rendered for five days) and MUST keep
-- viewer_group_ids (owners would stop seeing their own group-scoped greens).
-- Both are present below. CREATE OR REPLACE overwrites, it does not merge.
CREATE OR REPLACE FUNCTION public.get_feed(viewer uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
WITH friend_ids AS (
  SELECT friend_id AS id FROM public.friendships WHERE user_id = viewer
),
my_groups AS (
  SELECT group_id FROM public.viewer_group_ids(viewer)
),
ambient AS (
  SELECT
    count(*) FILTER (WHERE u.last_active_at > now() - interval '15 minutes') AS active_now,
    count(*) FILTER (WHERE u.last_green_at  > now() - interval '7 days')     AS recent_green
  FROM public.users u
  WHERE u.id IN (SELECT id FROM friend_ids)
),
visible AS (
  SELECT u.*
  FROM public.users u
  WHERE u.id IN (SELECT id FROM friend_ids)
    AND u.is_available = true
    -- 9.5 Part A: expired greens are invisible (NULL = legacy, never expires)
    AND (u.status_expires_at IS NULL OR u.status_expires_at > now())
    AND (
      u.visible_to IS NULL
      OR EXISTS (SELECT 1 FROM my_groups mg WHERE mg.group_id = ANY(u.visible_to))
    )
),
movers AS (
  SELECT id FROM visible
  UNION
  SELECT viewer
),
joins AS (
  SELECT mover_id, joiner_id
  FROM public.move_joins
  WHERE mover_id IN (SELECT id FROM movers)
    AND plan_id IS NULL   -- Phase 20: green joins only
),
joiner_info AS (
  SELECT id, display_name, avatar_url, phone
  FROM public.users
  WHERE id IN (SELECT DISTINCT joiner_id FROM joins)
),
friends_json AS (
  SELECT COALESCE(jsonb_agg(f ORDER BY f_sort DESC NULLS LAST), '[]'::jsonb) AS data
  FROM (
    SELECT
      v.status_set_at AS f_sort,
      jsonb_build_object(
        'id',          v.id,
        'displayName', v.display_name,
        'avatarUrl',   v.avatar_url,
        'statusNote',  v.status_note,
        'statusTime',  v.status_time,
        'phone',       v.phone,
        'statusSetAt', v.status_set_at,
        'visibleGroups', (
          SELECT COALESCE(jsonb_agg(g.name ORDER BY g.name), '[]'::jsonb)
          FROM public.groups g
          WHERE v.status_show_groups = true
            AND v.visible_to IS NOT NULL
            AND g.id = ANY(v.visible_to)
            AND g.id IN (SELECT group_id FROM my_groups)
        ),
        'joiners', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
                   'id', ji.id, 'displayName', ji.display_name, 'avatarUrl', ji.avatar_url)), '[]'::jsonb)
          FROM joins j
          JOIN joiner_info ji ON ji.id = j.joiner_id
          WHERE j.mover_id = v.id
        ),
        'joinedByMe', EXISTS (SELECT 1 FROM joins j WHERE j.mover_id = v.id AND j.joiner_id = viewer),
        'anchoredMove', (
          SELECT CASE WHEN sm.id IS NULL THEN NULL ELSE jsonb_build_object(
                   'id', sm.id, 'title', sm.title, 'description', sm.description,
                   'brand', sm.brand, 'category', sm.category,
                   'timeText', sm.time_text, 'linkUrl', sm.link_url) END
          FROM public.sponsored_moves sm WHERE sm.id = v.status_move_id
        )
      ) AS f
    FROM visible v
  ) rows
),
my_joiners_json AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', ji.id, 'displayName', ji.display_name, 'avatarUrl', ji.avatar_url, 'phone', ji.phone)), '[]'::jsonb) AS data
  FROM joins j
  JOIN joiner_info ji ON ji.id = j.joiner_id
  WHERE j.mover_id = viewer
)
SELECT jsonb_build_object(
  'friends',   (SELECT data FROM friends_json),
  'myJoiners', (SELECT data FROM my_joiners_json),
  'ambient',   jsonb_build_object(
     'activeNow',   COALESCE((SELECT active_now   FROM ambient), 0),
     'recentGreen', COALESCE((SELECT recent_green FROM ambient), 0)
  ),
  'wave', (
    SELECT jsonb_build_object('timeBucket', w.time_bucket, 'friendIds', to_jsonb(w.member_ids))
    FROM public.wave_group_for_viewer(viewer) w
  )
);
$$;

-- ── get_plans: the Mooves feed ───────────────────────────────────────────────
--
-- Deliberately a SEPARATE function rather than more surface area on get_feed,
-- which has already been broken twice by redefinition. Same visibility rule as
-- greens: you must be friends with the author, and a group-scoped Moove needs a
-- shared group (via viewer_group_ids, so owners count as members of their own).
--
-- Joiner phone numbers are returned ONLY to the author, who is the one who can
-- fire the group text.
CREATE OR REPLACE FUNCTION public.get_plans(viewer uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
WITH friend_ids AS (
  SELECT friend_id AS id FROM public.friendships WHERE user_id = viewer
),
my_groups AS (
  SELECT group_id FROM public.viewer_group_ids(viewer)
),
visible AS (
  SELECT p.*
  FROM public.plans p
  WHERE p.cancelled_at IS NULL
    AND p.expires_at > now()
    AND (p.author_id = viewer OR p.author_id IN (SELECT id FROM friend_ids))
    AND (
      p.author_id = viewer
      OR p.visible_to IS NULL
      OR EXISTS (SELECT 1 FROM my_groups mg WHERE mg.group_id = ANY(p.visible_to))
    )
),
pj AS (
  SELECT plan_id, joiner_id
  FROM public.move_joins
  WHERE plan_id IN (SELECT id FROM visible)
),
ji AS (
  SELECT id, display_name, avatar_url, phone
  FROM public.users
  WHERE id IN (SELECT DISTINCT joiner_id FROM pj)
)
SELECT COALESCE(jsonb_agg(x ORDER BY sort_at ASC), '[]'::jsonb)
FROM (
  SELECT
    v.start_at AS sort_at,
    jsonb_build_object(
      'id',           v.id,
      'authorId',     v.author_id,
      'authorName',   (SELECT display_name FROM public.users WHERE id = v.author_id),
      'authorAvatar', (SELECT avatar_url   FROM public.users WHERE id = v.author_id),
      'title',        v.title,
      'startAt',      v.start_at,
      'hasTime',      v.has_time,
      'locationText', v.location_text,
      'note',         v.note,
      'isMine',       v.author_id = viewer,
      'visibleGroups', (
        SELECT COALESCE(jsonb_agg(g.name ORDER BY g.name), '[]'::jsonb)
        FROM public.groups g
        WHERE v.visible_to IS NOT NULL
          AND g.id = ANY(v.visible_to)
          AND g.id IN (SELECT group_id FROM my_groups)
      ),
      'joiners', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                 'id', u.id, 'displayName', u.display_name, 'avatarUrl', u.avatar_url,
                 -- phones only to the author, who owns the group-text action
                 'phone', CASE WHEN v.author_id = viewer THEN u.phone ELSE NULL END)), '[]'::jsonb)
        FROM pj j JOIN ji u ON u.id = j.joiner_id
        WHERE j.plan_id = v.id
      ),
      'joinedByMe', EXISTS (SELECT 1 FROM pj j WHERE j.plan_id = v.id AND j.joiner_id = viewer)
    ) AS x
  FROM visible v
) rows;
$$;
