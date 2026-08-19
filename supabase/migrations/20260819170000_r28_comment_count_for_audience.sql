-- R28 — commentCount reflects the thread the viewer can actually open.
--
-- Phase 21 returned the real count only to the author and to people holding a
-- join, and 0 to everyone else. That was right while comments were joiners-only:
-- a non-zero count would have advertised a conversation the viewer could not
-- reach, and wall 3 said a card must give away nothing.
--
-- R28 opens the thread to everyone the Moove is already shared with, so the
-- premise is gone. Left alone, the count would now under-report to precisely the
-- people the feature was built for — someone deciding whether to speak up about
-- Saturday would see "0 comments" on a thread with four in it.
--
-- The predicate the CASE was enforcing is now redundant rather than relaxed:
-- every row reaching this expression has already passed the `visible` CTE, which
-- is the same audience test that governs the comment route. Dropping the CASE
-- does not widen who sees the number; it stops it lying to half of them.

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
      -- R28: no longer gated on having joined. Anyone reading this row is
      -- already inside the `visible` CTE, i.e. already in the Moove's audience,
      -- and the audience is exactly who may now open the thread. The old CASE
      -- returned 0 to non-joiners so the count could not hint that a private
      -- conversation existed; with the thread open to the same people, a zero
      -- would just be a lie about a tab they can tap.
      'commentCount', (
        SELECT count(*) FROM public.plan_comments c WHERE c.plan_id = v.id
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
