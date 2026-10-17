-- ─────────────────────────────────────────────────────────────────────────────
-- R39 — Past Mooves becomes a real page
--
-- One paged, searchable read over "the Mooves you went to", replacing R36's
-- fetch-everything-up-to-60 in /api/plans/past.
--
-- Membership is exactly R36's album rule (canAccessAlbum in src/lib/photos.ts):
-- you authored it, OR you hold a move_joins row whose plan_id IS this plan.
-- `plan_id IS NOT NULL` is the mandatory green-join filter (Phase 20.3) — a
-- green join carries a NULL plan_id and must never read as attending a Moove.
-- Cancelled Mooves are left out; only Mooves whose expires_at has passed count.
--
-- Paging is a keyset cursor on (start_at, id) DESC, not an offset, so a Moove
-- that becomes past while you scroll cannot shift a page under you. Pass both
-- before_start and before_id, or neither.
--
-- Search is a case-insensitive substring on title or location_text, over the
-- whole history. The user's text is escaped, so % and _ match themselves.
--
-- No new index: plans_author_idx and move_joins_joiner_idx cover both halves of
-- the membership set, and a person's history is small enough to sort in memory.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.past_mooves(
  viewer       uuid,
  q            text        DEFAULT NULL,
  before_start timestamptz DEFAULT NULL,
  before_id    uuid        DEFAULT NULL,
  page_size    int         DEFAULT 20
)
RETURNS TABLE (
  id            uuid,
  author_id     uuid,
  title         text,
  start_at      timestamptz,
  has_time      boolean,
  time_mode     text,
  location_text text
)
LANGUAGE sql
STABLE
AS $$
WITH mine AS (
  SELECT p.id AS plan_id FROM public.plans p WHERE p.author_id = viewer
  UNION
  SELECT j.plan_id FROM public.move_joins j
  WHERE j.joiner_id = viewer AND j.plan_id IS NOT NULL
),
pattern AS (
  SELECT CASE
    WHEN q IS NULL OR btrim(q) = '' THEN NULL
    ELSE '%' || replace(replace(replace(btrim(q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  END AS pat
)
SELECT p.id, p.author_id, p.title, p.start_at, p.has_time, p.time_mode, p.location_text
FROM public.plans p
JOIN mine m ON m.plan_id = p.id
CROSS JOIN pattern
WHERE p.cancelled_at IS NULL
  AND p.expires_at <= now()
  AND (pattern.pat IS NULL
       OR p.title ILIKE pattern.pat
       OR COALESCE(p.location_text, '') ILIKE pattern.pat)
  AND (before_start IS NULL OR before_id IS NULL
       OR (p.start_at, p.id) < (before_start, before_id))
ORDER BY p.start_at DESC, p.id DESC
LIMIT LEAST(GREATEST(page_size, 1), 51);
$$;

REVOKE ALL ON FUNCTION public.past_mooves(uuid, text, timestamptz, uuid, int) FROM PUBLIC, anon, authenticated;
