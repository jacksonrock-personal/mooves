-- ─────────────────────────────────────────────────────────────────────────────
-- 0008 — Green wave refinement (Phase 17.1 amendment)
--
-- Two constraints tighten what counts as a wave, so we never suggest a crowd of
-- people who don't know each other or aren't free at the same time:
--
--   1. SAME TIME BUCKET — friends only wave together if they share a time window.
--      Buckets: 'tonight', 'weekend', and 'now' (which ALSO absorbs greens with no
--      declared time — a no-time green reads as "right now").
--   2. CONNECTED GROUP — within a bucket, the friends must form ONE connected
--      cluster in the friendship graph (each linked to at least one other in the
--      group; friend-of-a-friend chains are fine). The viewer is NOT a bridge —
--      connectivity is measured among the green friends only, so a set of the
--      viewer's mutual-strangers never forms a wave.
--
-- Both surfaces (the in-app strip via get_feed, and the push via
-- green_wave_candidates) now derive from ONE helper, wave_group_for_viewer(),
-- so they can never disagree. A wave needs a connected same-bucket cluster of
-- ≥ 3; when several qualify, the largest wins (tie → most-recently-green).
--
-- Depends on: 0005 (get_feed), 0007 (green wave columns + green_wave_candidates).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Shared resolver ──────────────────────────────────────────────────────────
-- The single best wave group for a viewer, or NO ROWS when none qualifies.
-- "Green" mirrors the feed (is_available + unexpired) intersected with the
-- viewer's visibility rule, so the returned member set is always a subset of the
-- friends the feed already shows. Members are ordered most-recently-green first.
CREATE OR REPLACE FUNCTION public.wave_group_for_viewer(p_viewer uuid)
RETURNS TABLE(time_bucket text, member_ids uuid[], member_names text[], member_count int)
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE
  my_groups AS (
    SELECT group_id FROM public.group_members WHERE user_id = p_viewer
  ),
  -- The viewer's currently-green, visible friends, each stamped with its bucket.
  -- status_time is 'now' | 'tonight' | 'weekend' | NULL; NULL (and any stray
  -- value) collapses into 'now'.
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
      AND (
        u.visible_to IS NULL
        OR EXISTS (SELECT 1 FROM my_groups mg WHERE mg.group_id = ANY(u.visible_to))
      )
  ),
  -- Friendship edges BETWEEN green friends, restricted to same-bucket pairs so a
  -- component can never span two time windows. friendships stores both
  -- directions, so this is already symmetric.
  edges AS (
    SELECT f.user_id AS a, f.friend_id AS b
    FROM public.friendships f
    JOIN green ga ON ga.id = f.user_id
    JOIN green gb ON gb.id = f.friend_id
    WHERE ga.bucket = gb.bucket
  ),
  -- Transitive closure: every green friend reachable from each green friend
  -- (staying inside its bucket, since edges are bucket-local).
  reach AS (
    SELECT id AS node, id AS reachable FROM green
    UNION
    SELECT r.node, e.b FROM reach r JOIN edges e ON e.a = r.reachable
  ),
  -- Collapse each node to its component representative (min id in its reach).
  comp AS (
    SELECT node, min(reachable::text) AS rep FROM reach GROUP BY node
  ),
  grouped AS (
    SELECT
      (array_agg(g.bucket))[1] AS bucket,               -- all members share a bucket
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

-- ── Push path ────────────────────────────────────────────────────────────────
-- Viewers who, right now, have a qualifying wave group that INCLUDES the mover
-- (so this go-green event is what formed/extended it). Returns up to 3 names
-- (most-recently-green first), the wave size, and the shared time_bucket.
-- DROP first: 0007's version returned 3 columns; adding time_bucket changes the
-- OUT signature, which CREATE OR REPLACE cannot do.
DROP FUNCTION IF EXISTS public.green_wave_candidates(uuid);
CREATE OR REPLACE FUNCTION public.green_wave_candidates(mover uuid)
RETURNS TABLE(viewer uuid, green_names text[], green_count int, time_bucket text)
LANGUAGE sql
STABLE
AS $$
  SELECT v.viewer, w.member_names[1:3], w.member_count, w.time_bucket
  FROM (
    SELECT user_id AS viewer FROM public.friendships WHERE friend_id = mover
  ) v
  CROSS JOIN LATERAL public.wave_group_for_viewer(v.viewer) w
  WHERE mover = ANY(w.member_ids);
$$;

-- ── Feed path (in-app strip) ─────────────────────────────────────────────────
-- Identical to 0005's get_feed, plus a top-level `wave` field: null when no wave,
-- else { timeBucket, friendIds } — the client filters its own friends list to
-- those ids and renders the strip. friendIds ⊆ friends by construction.
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
