-- ─────────────────────────────────────────────────────────────────────────────
-- Editing repair + outsider tagging.
--
-- TWO things, both of which need the database:
--
-- 1. EDITING A MOOVE IS BROKEN, and half of why is right here. The composer has
--    no way to know what a Moove is currently scoped to: `get_plans` returns
--    `visibleGroups` as group NAMES, and only when show_groups is on. So the
--    edit form opened on "Everyone" no matter what the Moove was actually set
--    to, and saving wrote that lie back — a Moove scoped to one group became
--    visible to every friend the first time its author fixed a typo.
--
--    Fixed by returning the raw ids, TO THE AUTHOR ONLY. Same rule the joiner
--    phones already follow in this function: `CASE WHEN v.author_id = viewer`.
--    Nobody else is handed a group id they had no business receiving.
--
-- 2. TAGGING SOMEONE WHO IS NOT IN. `plan_taggable_friends` is the whole rule,
--    in one place, so the picker and the write path cannot disagree.
--
-- ⚠ get_plans has been silently broken twice (the 0008 expiry regression). The
-- definition below is the deployed one from 20260728040000 copied VERBATIM with
-- two keys added to the jsonb_build_object. Nothing else moved: the cancelled_at
-- / expires_at filters, the visible_to rule, the show_groups opt-in, the joiners
-- phone rule, the commentCount wall and the ORDER BY sort_at are untouched.
-- ─────────────────────────────────────────────────────────────────────────────

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
      'joinedByMe', EXISTS (SELECT 1 FROM pj j WHERE j.plan_id = v.id AND j.joiner_id = viewer),
      'commentCount', (
        SELECT CASE
          WHEN v.author_id = viewer
            OR EXISTS (SELECT 1 FROM pj j WHERE j.plan_id = v.id AND j.joiner_id = viewer)
          THEN (SELECT count(*) FROM public.plan_comments c WHERE c.plan_id = v.id)
          ELSE 0
        END
      ),
      -- ── THE TWO NEW KEYS ─────────────────────────────────────────────────
      -- Author only, both of them. These exist so the edit composer can open
      -- showing what the Moove is ACTUALLY scoped to instead of guessing
      -- "Everyone" and then writing that guess back over the truth.
      'visibleTo', (
        SELECT CASE WHEN v.author_id = viewer
          THEN COALESCE(to_jsonb(v.visible_to), 'null'::jsonb)
          ELSE 'null'::jsonb
        END
      ),
      'showGroups', (v.author_id = viewer AND v.show_groups)
    ) AS x
  FROM visible v
) rows;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- plan_taggable_friends — who may be named in a comment on this Moove without
-- already being in it.
--
-- This is a deliberate, bounded amendment to wall 2 ("you cannot pull someone
-- into a room they were never in"). The bound is: a tag can only ever name
-- somebody WHO ALREADY HAS THIS MOOVE IN THEIR OWN FEED. Tagging therefore
-- reveals nothing — not the Moove, not that it exists — to anyone who could not
-- already see it. It is a nudge toward a card they were already being shown.
--
-- Three conditions, all required:
--
--   a) The candidate is a FRIEND OF THE TAGGER. Not merely someone who can see
--      the Moove. Without this, a joiner opening the picker would be handed the
--      names of the host's friends they have never met — the picker would leak
--      the host's contact graph to everyone who joined.
--   b) The candidate can see this Moove, by exactly the rule in get_plans
--      above: friends with the author, and either the Moove is unscoped or they
--      are in one of its groups. Re-derived here rather than duplicated by
--      hand — same friendship direction (user_id = them, friend_id = author),
--      same owner-aware viewer_group_ids.
--   c) They are not already the author or a joiner, because those people are
--      the roster and the picker lists them separately.
--
-- The Moove must also still be live. A tag on an expired or cancelled Moove
-- would push somebody toward a card that is not there.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.plan_taggable_friends(p_plan uuid, p_viewer uuid)
RETURNS TABLE(id uuid, display_name text, avatar_url text)
LANGUAGE sql
STABLE
AS $$
  WITH plan AS (
    SELECT p.id, p.author_id, p.visible_to
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
      pl.visible_to IS NULL
      OR EXISTS (
        SELECT 1 FROM public.viewer_group_ids(m.uid) vg
        WHERE vg.group_id = ANY(pl.visible_to)
      )
    )
  ORDER BY u.display_name NULLS LAST;
$$;
