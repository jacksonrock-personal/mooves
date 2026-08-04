-- ─────────────────────────────────────────────────────────────────────────────
-- R25 — a friend's week.
--
-- Phase 22 said, in this file's own words: "PRIVATE. Nothing reads this table
-- on behalf of another user." This migration reverses that, deliberately, under
-- two rules Jackson signed off on:
--
--   1. CONFIRMED FRIENDS ONLY, on by default, no setting. Same rule as the
--      rail. If a friend can already see you go green, seeing that you planned
--      Thursday evening is not a larger disclosure.
--
--   2. GROUP SCOPING APPLIES. A green scoped away from you never reaches your
--      rail; a week scoped away from you must never reach the sheet either.
--
-- Rule 2 is why availability_slots is STILL not readable directly. There is no
-- policy on the table and none is added — the ONLY read path for someone else's
-- week is get_friend_week() below, which carries the friendship check and the
-- visibility predicate in the same breath as the rows. That makes the rule
-- structural rather than a filter somebody has to remember to apply, which is
-- exactly how greens work today (R16) and exactly what get_feed's history says
-- you want when a predicate is load-bearing.
--
-- ⚠ THE SCOPE COLUMNS ARE WRITTEN BY NOBODY YET. week_visible_to and
-- week_visible_user_ids are added, defaulted to NULL, and enforced — but no UI
-- sets them, so in practice every week is currently visible to every confirmed
-- friend, which IS the signed-off default. The picker belongs on the week
-- ritual sheet (Phase 22), at the moment someone sets their slots, and is a
-- separate change. The columns land now because retrofitting a scope check
-- into a shipped read path is the expensive version of this.
--
-- NOTHING HERE REDEFINES get_feed OR get_plans. Both have been silently broken
-- by redefinition twice (the 0008 expiry regression, then the get_plans edit
-- bug). This migration only adds.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── The week's audience ──────────────────────────────────────────────────────
-- Mirrors users.visible_to / users.visible_user_ids exactly, including the R16
-- rule that "unscoped" means BOTH are null. Separate columns rather than reuse:
-- the green pair is EPHEMERAL — it is cleared on go-grey and rewritten on every
-- go-green — and hanging a week's audience off a value that resets several
-- times a day would be a bug with a long fuse.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS week_visible_to      uuid[],
  ADD COLUMN IF NOT EXISTS week_visible_user_ids uuid[];

COMMENT ON COLUMN public.users.week_visible_to IS
  'R25: groups this user''s availability week is scoped to. Unioned with week_visible_user_ids. NULL in BOTH means every confirmed friend.';
COMMENT ON COLUMN public.users.week_visible_user_ids IS
  'R25: individual friends this user''s availability week is scoped to. NULL in BOTH means every confirmed friend.';


-- ── Can `viewer` see `target`'s week at all? ─────────────────────────────────
-- One predicate, one place. Both readers below call it, so the count on the
-- Friends row and the grid in the sheet can never disagree about who is allowed
-- to see what — which is the failure mode that makes scoped counts dangerous.
CREATE OR REPLACE FUNCTION public.can_see_week(viewer uuid, target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = target
      -- Rule 1: a confirmed friendship, in the viewer's own direction. This is
      -- the same directional read get_feed uses.
      AND EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE f.user_id = viewer AND f.friend_id = target
      )
      -- Rule 2: R16's predicate, verbatim in shape. Unscoped means NEITHER a
      -- group nor a named friend was picked. `viewer = ANY(NULL)` is NULL, not
      -- an error, and NULL inside this OR chain reads as "no match".
      AND (
        (u.week_visible_to IS NULL AND u.week_visible_user_ids IS NULL)
        OR EXISTS (
          SELECT 1 FROM public.viewer_group_ids(viewer) vg
          WHERE vg.group_id = ANY(u.week_visible_to)
        )
        OR viewer = ANY(u.week_visible_user_ids)
      )
  );
$$;


-- ── The seven days a week covers, for one user ───────────────────────────────
-- The window is derived from the TARGET's week_ritual_day, not the viewer's:
-- these are the slots they filled in on their own week, and rendering them
-- against somebody else's Monday would silently drop a day.
--
-- Same arithmetic as weekDates() in src/lib/availability.ts — start at the most
-- recent occurrence of ritual_day on or before today, run seven days. Read as a
-- plain calendar date, matching how slot_date is stored.
CREATE OR REPLACE FUNCTION public.week_start_for(target uuid)
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT current_date - (
    (EXTRACT(DOW FROM current_date)::int - COALESCE(u.week_ritual_day, 1) + 7) % 7
  )
  FROM public.users u
  WHERE u.id = target;
$$;


-- ── The sheet's payload ──────────────────────────────────────────────────────
-- Returns NULL when the viewer may not see this week — not an empty week.
-- "He has nothing on" and "you are not allowed to know" are different answers
-- and the route turns the second into a 404.
--
-- isGreen is filtered by the GREEN's own scope (users.visible_to /
-- visible_user_ids), not the week's, because a live green is a different object
-- with a different audience. A friend who is green but scoped away from you
-- shows here exactly as they show in your rail: not green.
CREATE OR REPLACE FUNCTION public.get_friend_week(viewer uuid, target uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH allowed AS (
    SELECT public.can_see_week(viewer, target) AS ok
  ),
  win AS (
    SELECT public.week_start_for(target) AS d0
  ),
  u AS (
    SELECT * FROM public.users WHERE id = target
  ),
  slots AS (
    SELECT s.slot_date, s.part
    FROM public.availability_slots s, win
    WHERE s.user_id = target
      AND s.slot_date >= win.d0
      AND s.slot_date <  win.d0 + 7
    ORDER BY s.slot_date, s.part
  )
  SELECT CASE WHEN NOT (SELECT ok FROM allowed) THEN NULL ELSE
    jsonb_build_object(
      'id',          (SELECT id FROM u),
      'displayName', (SELECT display_name FROM u),
      'avatarUrl',   (SELECT avatar_url FROM u),
      'phone',       (SELECT phone FROM u),
      'weekStart',   (SELECT d0 FROM win),
      'weekEnd',     (SELECT d0 + 6 FROM win),
      'isGreen', (
        SELECT COALESCE((
          SELECT u.is_available
             AND (u.status_expires_at IS NULL OR u.status_expires_at > now())
             AND (
               (u.visible_to IS NULL AND u.visible_user_ids IS NULL)
               OR EXISTS (
                 SELECT 1 FROM public.viewer_group_ids(viewer) vg
                 WHERE vg.group_id = ANY(u.visible_to)
               )
               OR viewer = ANY(u.visible_user_ids)
             )
          FROM u
        ), false)
      ),
      'statusTime',      (SELECT status_time FROM u),
      'statusExpiresAt', (SELECT status_expires_at FROM u),
      'slots', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('date', slot_date, 'part', part)), '[]'::jsonb)
        FROM slots
      )
    )
  END;
$$;


-- ── The counts behind "4 this week" on the Friends list ──────────────────────
-- Because scoping applies, this is a SCOPED count: two people looking at the
-- same friend can honestly see different numbers. That is why it runs through
-- can_see_week() rather than counting rows — a plain aggregate would leak the
-- existence of slots the viewer is not entitled to, which is the same class of
-- bug as a scoped green reaching the wrong rail.
--
-- Past slots are counted. A week with Mon–Wed erased reads as "he has almost
-- nothing on" when he actually had three, and the sheet dims them rather than
-- dropping them, so the chip has to agree with the sheet.
CREATE OR REPLACE FUNCTION public.friend_week_counts(viewer uuid)
RETURNS TABLE(friend_id uuid, slot_count integer)
LANGUAGE sql
STABLE
AS $$
  SELECT
    f.friend_id,
    COALESCE((
      SELECT count(*)::int
      FROM public.availability_slots s
      WHERE s.user_id = f.friend_id
        AND s.slot_date >= public.week_start_for(f.friend_id)
        AND s.slot_date <  public.week_start_for(f.friend_id) + 7
    ), 0)
  FROM public.friendships f
  WHERE f.user_id = viewer
    AND public.can_see_week(viewer, f.friend_id);
$$;


-- Service-role only, like every other function in this app. The routes call
-- these with the service client after resolving x-user-id; nothing reaches them
-- from the browser.
REVOKE ALL ON FUNCTION public.can_see_week(uuid, uuid)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.week_start_for(uuid)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_friend_week(uuid, uuid)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.friend_week_counts(uuid)      FROM PUBLIC, anon, authenticated;
