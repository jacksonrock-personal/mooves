-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 24.4 — backfill activated_at from join history.
--
-- Data only, no schema. The column landed in 20260803120000; this gives existing
-- users the timestamp they would have had, so the metric is not artificially
-- zero on the day it ships and time-to-activation has a baseline to compare to.
--
-- A join activates BOTH sides — the joiner did something with a friend, the
-- author had something land — so move_joins is read twice, once from each end,
-- and the EARLIEST of the two wins.
--
-- `WHERE activated_at IS NULL` makes this idempotent and re-runnable: a user who
-- has already been marked keeps their original timestamp rather than having the
-- goalpost moved.
-- ─────────────────────────────────────────────────────────────────────────────

WITH first_event AS (
  SELECT user_id, min(created_at) AS at
  FROM (
    SELECT joiner_id AS user_id, created_at FROM public.move_joins
    UNION ALL
    SELECT mover_id  AS user_id, created_at FROM public.move_joins
  ) AS both_sides
  GROUP BY user_id
)
UPDATE public.users u
   SET activated_at = f.at
  FROM first_event f
 WHERE u.id = f.user_id
   AND u.activated_at IS NULL;
