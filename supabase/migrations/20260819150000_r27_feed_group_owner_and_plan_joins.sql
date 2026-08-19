-- R27 — two things get_feed had wrong, both found while fixing the seeding stall.
--
-- Neither is new breakage; both are regressions that survived because get_feed
-- is redefined wholesale by every migration that touches it, and a redefinition
-- silently drops whatever the previous one added. This is the third time that
-- has happened (see the header of 20260729130000). Re-emitting the whole body
-- is the cost of CREATE OR REPLACE on a function; the fix is to read the live
-- definition before redefining, not to trust the last migration that mentions it.
--
--
-- 1. GROUP OWNERS COULD NOT SEE GREENS SCOPED TO THEIR OWN GROUP.
--
-- A group's owner has no row in group_members — that asymmetry is why
-- viewer_group_ids() exists (20260727183000). R16 rebuilt get_feed and wrote
-- my_groups as a raw group_members read, dropping the call. It kept
-- viewer_group_ids in get_plans in the same file, so the two halves disagreed:
-- an owner scoping a green to their own group vanished from their own feed,
-- while a Moove scoped the same way stayed visible.
--
--
-- 2. MOOVE JOINERS RENDERED AS GREEN JOINERS.
--
-- move_joins serves both objects, discriminated by plan_id, and on a plan join
-- mover_id holds the PLAN'S AUTHOR rather than a person who went green. The
-- joins CTE filtered on mover_id alone, so every "I'm in" on your Moove came
-- back attached to your green tile, and joinedByMe went true for a green nobody
-- had joined. Phase 20.3 documents the filter as mandatory on every green-side
-- read; this one never got it.
--
-- Now that green joins are retired (294524e) and no route creates them, almost
-- every row in move_joins is a plan join — so in practice the unfiltered CTE
-- was returning the wrong rows nearly all of the time.

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
      -- R16: unscoped means NEITHER a group nor a named friend was picked.
      (u.visible_to IS NULL AND u.visible_user_ids IS NULL)
      OR EXISTS (SELECT 1 FROM my_groups mg WHERE mg.group_id = ANY(u.visible_to))
      OR viewer = ANY(u.visible_user_ids)
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
    AND plan_id IS NULL
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
