-- ─────────────────────────────────────────────────────────────────────────────
-- Coarse Moove timing + the group-label opt-in
--
-- Mooves can now be scheduled roughly ("this weekend") or exactly. This retires
-- the old dividing line "a Moove has a day, a green does not" — a coarse Moove
-- has no day. The replacement:
--
--     a green is YOU BEING FREE, a Moove is A THING YOU ARE DOING
--
-- Availability versus content. Under that rule a coarse Moove is coherent.
--
-- start_at stops being a real start time for coarse Mooves and becomes a SORT
-- KEY, stamped at the END of the window, so an exact "Saturday 9am" sorts above
-- "sometime this weekend" — concrete before vague.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS time_mode TEXT NOT NULL DEFAULT 'datetime'
    CHECK (time_mode IN ('tonight','week','weekend','date','datetime'));

-- 18.2's opt-in, now on Mooves too. Until this existed, Moove cards labelled
-- groups with NO opt-in at all, contradicting how greens behave.
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS show_groups BOOLEAN NOT NULL DEFAULT false;

-- get_plans gains timeMode, and visibleGroups becomes opt-in. The viewer-side
-- rule is unchanged: you are never told about a group you are not in.
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
      'joinedByMe', EXISTS (SELECT 1 FROM pj j WHERE j.plan_id = v.id AND j.joiner_id = viewer)
    ) AS x
  FROM visible v
) rows;
$$;
