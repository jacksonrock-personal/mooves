-- ─────────────────────────────────────────────────────────────────────────────
-- 0007 — Green wave (Phase 17.1)
-- A "green wave" fires for a viewer the moment their count of CURRENTLY-GREEN,
-- VISIBLE friends reaches exactly 3. Detection is per-viewer, evaluated on every
-- go-green write (the mover fans out to their friends). Delivery is a named push
-- ("Sam, Alex, and Jordan are free") — the one push that ends app usage.
--
-- Adds:
--   users.last_wave_at       — per-viewer push cooldown stamp (NULL = never waved)
--   users.wave_push_enabled  — per-viewer opt-out (default on)
--   green_wave_candidates()  — the graph query the send path runs
--
-- The in-app wave strip is derived client-side from the existing feed (≥3 green
-- friends), so it needs nothing here. Only the push path uses this migration.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_wave_at TIMESTAMPTZ;
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS wave_push_enabled BOOLEAN NOT NULL DEFAULT true;

-- Viewers who, right now, have EXACTLY 3 currently-green friends they can see, and
-- for whom the mover is one of those 3 (so this go-green event is what completed the
-- wave). Green = is_available AND unexpired; visibility mirrors get_feed's visible_to
-- rule. Returns up to 3 green-friend names (most-recently-green first) + the count.
CREATE OR REPLACE FUNCTION public.green_wave_candidates(mover uuid)
RETURNS TABLE(viewer uuid, green_names text[], green_count int)
LANGUAGE sql
STABLE
AS $$
  WITH viewers AS (
    -- Users who have the mover as a friend (only they can be affected by its green).
    SELECT user_id AS viewer FROM public.friendships WHERE friend_id = mover
  ),
  green_per_viewer AS (
    SELECT
      vw.viewer,
      u.id AS friend_id,
      COALESCE(u.display_name, 'A friend') AS display_name,
      u.status_set_at
    FROM viewers vw
    JOIN public.friendships f ON f.user_id = vw.viewer      -- the viewer's friends
    JOIN public.users u ON u.id = f.friend_id
    WHERE u.is_available = true
      AND (u.status_expires_at IS NULL OR u.status_expires_at > now())
      AND (
        u.visible_to IS NULL
        OR EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.user_id = vw.viewer AND gm.group_id = ANY(u.visible_to)
        )
      )
  ),
  counted AS (
    SELECT
      viewer,
      count(*) AS green_count,
      bool_or(friend_id = mover) AS includes_mover,
      (array_agg(display_name ORDER BY status_set_at DESC NULLS LAST))[1:3] AS names
    FROM green_per_viewer
    GROUP BY viewer
  )
  SELECT viewer, names, green_count::int
  FROM counted
  WHERE green_count = 3 AND includes_mover;
$$;
