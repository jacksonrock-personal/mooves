-- ─────────────────────────────────────────────────────────────────────────────
-- 0009 — Restore green auto-expiry to get_feed (regression fix)
--
-- 0008 rebuilt get_feed from 0005's body to add the `wave` field, which silently
-- reverted 0006's expiry filter: CREATE OR REPLACE overwrites, it does not merge.
-- Expired greens have been rendering on the feed forever since 0008 shipped.
-- (wave_group_for_viewer kept its own copy of the filter, so the wave strip was
-- unaffected — only the friends list leaked.)
--
-- This is 0008's get_feed verbatim plus the one missing line in `visible`.
--
--   ⚠ ANY future redefinition of get_feed MUST carry this filter forward:
--       AND (u.status_expires_at IS NULL OR u.status_expires_at > now())
--     It is the only thing hiding expired greens — expiry is lazy (no cron) and
--     the client only self-reconciles the viewer's OWN green, never friends'.
-- ─────────────────────────────────────────────────────────────────────────────

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
