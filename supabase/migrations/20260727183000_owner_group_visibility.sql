-- ─────────────────────────────────────────────────────────────────────────────
-- Owner-implicit group membership — visibility fix
--
-- `group_members` never contains a group's owner. That is deliberate and load-
-- bearing elsewhere (the group_members_owner_all RLS policy keys off
-- groups.owner_id; /api/groups/[id]/leave refuses to let an owner leave;
-- PUT /api/groups/[id] replaces the member list wholesale, which would wipe an
-- owner row on every edit). The owner is a member by virtue of owning.
--
-- But every visibility check resolved "my groups" from group_members alone, so
-- an owner counted as belonging to nothing. Consequence: a green scoped to a
-- group was visible to every member of that group EXCEPT the person who owns it
-- — no feed card, no group label, no wave, no push, no SMS reply.
--
-- Recorded as a known open flag in mooves-prd.md: Phase 10 shipped owner-scoped
-- groups (Option A) and Phase 9's visibility scoping assumed symmetric
-- membership. This reconciles the two, in one place both callers share.
--
-- Widening only, and only to the owner: a viewer still needs friendship with the
-- mover, and non-members are unaffected.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── The single definition of "which groups is this user in" ──────────────────
CREATE OR REPLACE FUNCTION public.viewer_group_ids(p_user uuid)
RETURNS TABLE(group_id uuid)
LANGUAGE sql
STABLE
AS $$
  SELECT gm.group_id FROM public.group_members gm WHERE gm.user_id = p_user
  UNION
  SELECT g.id        FROM public.groups g         WHERE g.owner_id = p_user;
$$;

-- ── wave_group_for_viewer — 18.1's body, my_groups now owner-aware ───────────
-- Byte-identical to 20260727151328 apart from the my_groups CTE. Keeps 18.1's
-- week-green exclusion. green_wave_candidates delegates here, so this covers
-- both the wave push path and the in-app strip.
CREATE OR REPLACE FUNCTION public.wave_group_for_viewer(p_viewer uuid)
RETURNS TABLE(time_bucket text, member_ids uuid[], member_names text[], member_count int)
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE
  my_groups AS (
    SELECT group_id FROM public.viewer_group_ids(p_viewer)
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

-- ── get_feed — 18.2's body, my_groups now owner-aware ────────────────────────
-- ⚠ Fifth definition. CREATE OR REPLACE overwrites, it does not merge. Diffed
--   against the live database before writing (\sf public.get_feed): identical to
--   20260727151328. Everything below is carried forward verbatim apart from the
--   my_groups CTE — in particular the status_expires_at filter in `visible`,
--   which 0008 dropped by rebuilding from an older body (expired greens rendered
--   for five days). Any future redefinition must carry it forward too.
--
-- my_groups feeds two things, and both were wrong for owners: the visibility
-- gate in `visible`, and the visibleGroups label (18.2), which intersects the
-- mover's visible_to with the viewer's own groups so nobody learns about a group
-- they are not in. An owner now passes both.
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
