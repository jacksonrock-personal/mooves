-- ─────────────────────────────────────────────────────────────────────────────
-- R8 — likes on a comment, and @tagging limited to the Moove's roster
--
-- THIS AMENDS PHASE 21, DELIBERATELY. §21.2 said "no @mentions, no reactions on
-- comments" and listed both under Out of scope; reactions were also cut outright
-- at Phase 20. Both are reversed here, narrowly, and the reasoning is written
-- into the spec rather than left to be inferred from this file.
--
-- What still holds, and is what makes the amendment survivable:
--   • both live ONLY inside the Moove sheet, which already requires having
--     joined, so neither is visible or inferable to a non-joiner (wall 3);
--   • a tag can only name someone already IN the Moove (wall 2);
--   • both die with the Moove, by cascade (wall 4);
--   • neither produces a push, a badge, a dot, or a mention inbox.
--
-- get_feed and get_plans are NOT touched. Again.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Likes ────────────────────────────────────────────────────────────────────
--
-- The composite PK is the whole integrity story: one row per (comment, liker)
-- means a double-tap, a retry or a racing second device cannot double-count, and
-- no counter column can drift out of true because there is no counter column.
CREATE TABLE IF NOT EXISTS public.plan_comment_likes (
  comment_id UUID        NOT NULL REFERENCES public.plan_comments(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.users(id)         ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id)
);

-- Counting likes for a sheet-full of comments is the only read this table has.
CREATE INDEX IF NOT EXISTS plan_comment_likes_comment_idx
  ON public.plan_comment_likes (comment_id);

-- RLS on, NO policies: service-role only, matching plan_comments and plans.
-- Not added to the realtime publication — likes do not live-update, for the same
-- reason comments do not: live-appearing reactions are what makes a surface feel
-- like chat.
ALTER TABLE public.plan_comment_likes ENABLE ROW LEVEL SECURITY;

-- ── Mentions ─────────────────────────────────────────────────────────────────
--
-- The body keeps the literal "@Katherine" text the author typed; this array is
-- the VALIDATED set of user ids behind it, written server-side after checking
-- every tag against the roster. Two jobs:
--   1. highlighting renders from ids, not from parsing display names at read
--      time, so a name containing a space or an @ cannot break the render;
--   2. it is the enforcement record — a hand-built request naming a non-joiner
--      has that id dropped here rather than silently stored.
--
-- Deliberately NOT a join table. Mentions are never queried FROM the user's
-- side ("show me everything I was tagged in") because that query is an inbox,
-- and an inbox is the thing this whole amendment is built to avoid.
ALTER TABLE public.plan_comments
  ADD COLUMN IF NOT EXISTS mentions UUID[] NOT NULL DEFAULT '{}';
