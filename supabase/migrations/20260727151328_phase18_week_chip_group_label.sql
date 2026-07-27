-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 18 — "This week" time chip (18.1) + group visibility label (18.2)
--
-- 18.1  users.status_time gains 'week'. Expiry (3am Friday, viewer-local) is
--       computed client-side like every other chip; nothing here enforces it.
-- 18.2  users.status_show_groups — per-moove opt-in to naming the groups a green
--       was shared with. Ephemeral: cleared on go-grey with the other status
--       fields (the API write path does that, same as status_note/status_time).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 18.1 — allow the new chip value ──────────────────────────────────────────
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_status_time_check;
ALTER TABLE public.users ADD CONSTRAINT users_status_time_check
  CHECK (status_time = ANY (ARRAY['now'::text, 'tonight'::text, 'week'::text, 'weekend'::text]));

-- ── 18.2 — the opt-in flag ───────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status_show_groups BOOLEAN NOT NULL DEFAULT false;

-- ── 18.1 — keep 'week' out of green waves ────────────────────────────────────
-- A wave is a CONNECTED SAME-TIME group (17.1b). "Free sometime this week" is not
-- a time window anyone is jointly in, so a week-green must not form or join one.
--
-- This has to be an explicit filter, NOT a bucket mapping. The bucket CASE below
-- collapses every unrecognised status_time into 'now' — so simply adding 'week'
-- to the CHECK constraint without touching this function would have silently
-- pooled week-greens together with "free right now" and fired waves on them.
--
-- Otherwise identical to 0008's definition. green_wave_candidates delegates to
-- this function, so excluding here covers the push path and the in-app strip.
CREATE OR REPLACE FUNCTION public.wave_group_for_viewer(p_viewer uuid)
RETURNS TABLE(time_bucket text, member_ids uuid[], member_names text[], member_count int)
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE
  my_groups AS (
    SELECT group_id FROM public.group_members WHERE user_id = p_viewer
  ),
  green AS (
    SELECT
      u.id,
      COALESCE(u.display_name, 'A friend') AS display_name,
      u.status_set_at,
      CASE WHEN u.status_time IN ('tonight', 'weekend') THEN u.status_time ELSE 'now' END AS bucket
    FROM public.friendships f
    JOIN public.users u ON u.id = f.friend_id
    WHERE f.user_id = p_viewer
      AND u.is_available = true
      AND (u.status_expires_at IS NULL OR u.status_expires_at > now())
      -- 18.1: week-greens are never wave material.
      AND (u.status_time IS DISTINCT FROM 'week')
      AND (
        u.visible_to IS NULL
        OR EXISTS (SELECT 1 FROM my_groups mg WHERE mg.group_id = ANY(u.visible_to))
      )
  ),
  edges AS (
    SELECT f.user_id AS a, f.friend_id AS b
    FROM public.friendships f
    JOIN green ga ON ga.id = f.user_id
    JOIN green gb ON gb.id = f.friend_id
    WHERE ga.bucket = gb.bucket
  ),
  reach AS (
    SELECT id AS node, id AS reachable FROM green
    UNION
    SELECT r.node, e.b FROM reach r JOIN edges e ON e.a = r.reachable
  ),
  comp AS (
    SELECT node, min(reachable::text) AS rep FROM reach GROUP BY node
  ),
  grouped AS (
    SELECT
      (array_agg(g.bucket))[1] AS bucket,
      array_agg(g.id           ORDER BY g.status_set_at DESC NULLS LAST) AS ids,
      array_agg(g.display_name ORDER BY g.status_set_at DESC NULLS LAST) AS names,
      count(*)::int AS sz,
      max(g.status_set_at) AS newest
    FROM comp c
    JOIN green g ON g.id = c.node
    GROUP BY c.rep
  )
  SELECT bucket, ids, names, sz
  FROM grouped
  WHERE sz >= 3
  ORDER BY sz DESC, newest DESC NULLS LAST
  LIMIT 1;
$$;

-- ── 18.2 — get_feed gains per-viewer visibleGroups ───────────────────────────
-- ⚠ This is the fourth definition of get_feed. It MUST keep the
--   status_expires_at filter in `visible` — 0008 dropped it by rebuilding from
--   0005's body, and expired greens rendered for five days (fixed in
--   20260727140000). CREATE OR REPLACE overwrites, it does not merge.
--
-- visibleGroups is the INTERSECTION of the mover's visible_to and the viewer's
-- own group memberships, resolved to names. A viewer is never told about a group
-- they are not in — the same rule as the SMS feed check, where a viewer excluded
-- by visible_to must not learn hidden green friends exist. Consequence: the same
-- moove yields different labels for different viewers, by design.
-- Empty array when the mover has not opted in, or when scope is everyone.
CREATE OR REPLACE FUNCTION public.get_feed(viewer uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
WITH friend_ids AS (
  SELECT friend_id AS id FROM public.friendships WHERE user_id = viewer
),
my_groups AS (
  SELECT group_id FROM public.group_members WHERE user_id = viewer
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
