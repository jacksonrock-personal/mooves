-- ─────────────────────────────────────────────────────────────────────────────
-- R16 — visibility can name a PERSON, not just a group.
--
-- Until now the only way to narrow a green or a Moove was to a group, so wanting
-- three particular people on it meant creating a permanent group to serve one
-- Saturday. Two new columns carry the individuals, and three functions learn to
-- read them.
--
-- THE RULE, in one line: an audience is the UNION of the picked groups and the
-- picked individuals, and "unscoped" now means BOTH are null.
--
-- That last clause is the whole risk in this migration. Every one of the three
-- predicates below used to treat `visible_to IS NULL` as "everyone can see it".
-- If any of them kept that reading, a Moove scoped to two named friends would
-- have `visible_to = NULL` and would therefore be shown to EVERY friend of the
-- author — the exact inverse of what the author asked for. So the null check is
-- paired everywhere: `(visible_to IS NULL AND visible_user_ids IS NULL)`.
--
-- ⚠ get_feed and get_plans have each been silently broken by redefinition
-- before (the 0008 expiry regression, then the get_plans edit bug). CREATE OR
-- REPLACE overwrites, it does not merge. Both bodies below are the currently
-- deployed ones copied VERBATIM, with ONLY the visibility predicate changed and
-- (for get_plans) one key added. Everything else is untouched and must stay so:
--
--   get_feed  — the expiry filter `(u.status_expires_at IS NULL OR ... > now())`
--   get_plans — cancelled_at / expires_at, the show_groups opt-in, the joiner
--               phone rule, the commentCount wall, ORDER BY sort_at
--
-- On NULL semantics: `viewer = ANY(NULL)` evaluates to NULL, not an error, and
-- NULL inside this OR chain behaves exactly as "no match" — the row survives
-- only if some other branch is true. That is the intended reading.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS visible_user_ids uuid[];
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS visible_user_ids uuid[];

COMMENT ON COLUMN public.plans.visible_user_ids IS
  'R16: individual friends this Moove is scoped to. Unioned with visible_to. NULL in BOTH means everyone.';
COMMENT ON COLUMN public.users.visible_user_ids IS
  'R16: individual friends the current green is scoped to. Cleared on go-grey alongside visible_to.';


-- ── get_feed ─────────────────────────────────────────────────────────────────
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


-- ── get_plans ────────────────────────────────────────────────────────────────
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
      -- R16: unscoped means NEITHER a group nor a named friend was picked.
      OR (p.visible_to IS NULL AND p.visible_user_ids IS NULL)
      OR EXISTS (SELECT 1 FROM my_groups mg WHERE mg.group_id = ANY(p.visible_to))
      OR viewer = ANY(p.visible_user_ids)
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
      'timeMode',     v.time_mode,
      'locationText', v.location_text,
      'note',         v.note,
      'isMine',       v.author_id = viewer,
      'sponsorBrand', (
        SELECT sm.brand FROM public.sponsored_moves sm WHERE sm.id = v.sponsored_move_id
      ),
      'visibleGroups', (
        SELECT COALESCE(jsonb_agg(g.name ORDER BY g.name), '[]'::jsonb)
        FROM public.groups g
        WHERE v.show_groups = true
          AND v.visible_to IS NOT NULL
          AND g.id = ANY(v.visible_to)
          AND g.id IN (SELECT group_id FROM my_groups)
      ),
      'joiners', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                 'id', u.id, 'displayName', u.display_name, 'avatarUrl', u.avatar_url,
                 'phone', CASE WHEN v.author_id = viewer THEN u.phone ELSE NULL END)), '[]'::jsonb)
        FROM pj j JOIN ji u ON u.id = j.joiner_id
        WHERE j.plan_id = v.id
      ),
      'joinedByMe', EXISTS (SELECT 1 FROM pj j WHERE j.plan_id = v.id AND j.joiner_id = viewer),
      'commentCount', (
        SELECT CASE
          WHEN v.author_id = viewer
            OR EXISTS (SELECT 1 FROM pj j WHERE j.plan_id = v.id AND j.joiner_id = viewer)
          THEN (SELECT count(*) FROM public.plan_comments c WHERE c.plan_id = v.id)
          ELSE 0
        END
      ),
      'visibleTo', (
        SELECT CASE WHEN v.author_id = viewer
          THEN COALESCE(to_jsonb(v.visible_to), 'null'::jsonb)
          ELSE 'null'::jsonb
        END
      ),
      -- R16, author only, same rule as visibleTo above and for the same reason:
      -- without it the edit composer cannot know who the Moove is scoped to, and
      -- would write its guess back over the truth (the R12 bug, exactly).
      'visibleUserIds', (
        SELECT CASE WHEN v.author_id = viewer
          THEN COALESCE(to_jsonb(v.visible_user_ids), 'null'::jsonb)
          ELSE 'null'::jsonb
        END
      ),
      'showGroups', (v.author_id = viewer AND v.show_groups)
    ) AS x
  FROM visible v
) rows;
$$;


-- ── plan_taggable_friends ────────────────────────────────────────────────────
-- Condition (b) must learn the same rule, or somebody added to a Moove BY NAME
-- can see it in their feed but cannot be tagged in it — the picker and the
-- visibility rule would disagree, which is the precise failure this function was
-- written to make impossible.
CREATE OR REPLACE FUNCTION public.plan_taggable_friends(p_plan uuid, p_viewer uuid)
RETURNS TABLE(id uuid, display_name text, avatar_url text)
LANGUAGE sql
STABLE
AS $$
  WITH plan AS (
    SELECT p.id, p.author_id, p.visible_to, p.visible_user_ids
    FROM public.plans p
    WHERE p.id = p_plan
      AND p.cancelled_at IS NULL
      AND p.expires_at > now()
  ),
  -- (a) the tagger's own friends, and nobody else's
  mine AS (
    SELECT f.friend_id AS uid
    FROM public.friendships f
    WHERE f.user_id = p_viewer
  ),
  -- (c) everyone already in the room
  roster AS (
    SELECT author_id AS uid FROM plan
    UNION
    SELECT j.joiner_id FROM public.move_joins j WHERE j.plan_id = p_plan
  )
  SELECT u.id, u.display_name, u.avatar_url
  FROM mine m
  JOIN plan pl ON true
  JOIN public.users u ON u.id = m.uid
  WHERE m.uid <> p_viewer
    AND m.uid NOT IN (SELECT uid FROM roster)
    -- (b) they can already see this Moove in their own feed
    AND EXISTS (
      SELECT 1 FROM public.friendships f2
      WHERE f2.user_id = m.uid AND f2.friend_id = pl.author_id
    )
    AND (
      (pl.visible_to IS NULL AND pl.visible_user_ids IS NULL)
      OR EXISTS (
        SELECT 1 FROM public.viewer_group_ids(m.uid) vg
        WHERE vg.group_id = ANY(pl.visible_to)
      )
      OR m.uid = ANY(pl.visible_user_ids)
    )
  ORDER BY u.display_name NULLS LAST;
$$;
