-- ─────────────────────────────────────────────────────────────────────────────
-- 0002a — atomic event-counter RPCs  (STATUS: pending)
-- Safe to apply ANY TIME: purely additive. Nothing calls these until the P3 code
-- ships, so applying early has zero effect on current behavior.
-- Event counters increment on every occurrence (not derivable from a source row).
-- ─────────────────────────────────────────────────────────────────────────────

-- Batch impression bump — one round trip, race-free (replaces N read-modify-writes).
CREATE OR REPLACE FUNCTION increment_move_impressions(move_ids uuid[])
RETURNS void LANGUAGE sql AS $$
  UPDATE public.sponsored_moves
     SET impressions = impressions + 1
   WHERE id = ANY(move_ids);
$$;

-- Increment clicks and return the link in one shot. Empty result = move not found
-- (route returns 404). A matched row with NULL link_url returns one row with NULL —
-- the route distinguishes the two by row count, not by null-ness.
CREATE OR REPLACE FUNCTION record_move_click(p_move_id uuid)
RETURNS TABLE (link_url text) LANGUAGE sql AS $$
  UPDATE public.sponsored_moves
     SET clicks = clicks + 1
   WHERE id = p_move_id
  RETURNING link_url;
$$;

-- Bump the bring-over flywheel counter (event count, one per go-green-with-anchor).
CREATE OR REPLACE FUNCTION increment_brought_over(p_move_id uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE public.sponsored_moves
     SET brought_over_count = brought_over_count + 1
   WHERE id = p_move_id;
$$;
