-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 21, second revision — comments move into a bottom sheet.
--
-- The card now shows a comment count, which the first revision had ruled out.
-- That line ("no comment count anywhere, for anyone") was a side effect of the
-- single-arrow merge, NOT one of the four walls. The wall is narrower and is
-- enforced right here:
--
--   WALL 3 — invisible to anyone who has not joined.
--
-- `commentCount` is 0 unless the viewer is the author or holds a move_joins row
-- for this plan. A non-joiner is not sent a number they then have to be trusted
-- not to render. The count never leaves the database.
--
-- It is a TOTAL, not an unread count. It reads the same whether you have opened
-- the sheet ten times or never, so it cannot nag and is not a badge.
--
-- ⚠ get_plans has been silently broken twice before (the 0008 expiry
-- regression). This definition is the deployed one from 20260727235711 copied
-- verbatim with ONE key added to the jsonb_build_object. Nothing else moved:
-- the cancelled_at / expires_at filters, the visible_to rule, the show_groups
-- opt-in, the joiners phone rule and the ORDER BY sort_at are all untouched.
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
      -- ── THE ONE NEW KEY ──────────────────────────────────────────────────
      -- Zero for anyone who has not joined. Wall 3, in the database.
      'commentCount', (
        SELECT CASE
          WHEN v.author_id = viewer
            OR EXISTS (SELECT 1 FROM pj j WHERE j.plan_id = v.id AND j.joiner_id = viewer)
          THEN (SELECT count(*) FROM public.plan_comments c WHERE c.plan_id = v.id)
          ELSE 0
        END
      )
    ) AS x
  FROM visible v
) rows;
$$;
