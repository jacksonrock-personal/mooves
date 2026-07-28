-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 21 — Comments on a Moove
--
-- This is the phase that consciously amends "no in-app messaging, ever". The
-- amendment holds only while four walls hold, and two of them are enforced here:
--
--   1. ONLY ON A MOOVE. plan_id is NOT NULL with no default and no green path.
--      A green is you being free, a Moove is a thing you are doing (Phase 20's
--      second revision). Availability takes no text; content does.
--   4. DIES WITH THE MOOVE. ON DELETE CASCADE off plans, and the API refuses to
--      read or write once expires_at passes or cancelled_at is set. There is
--      never a backlog to come back and check.
--
-- The other two walls (joined-only, invisible-to-everyone-else) live in the API
-- route, because access depends on move_joins and this table is service-role
-- only anyway.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.plan_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id    UUID        NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  author_id  UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- 500 is the cap settled at mockup approval. Long enough for real logistics
  -- ("parking fills up by nine, I have spare harnesses, we start on the slab"),
  -- short enough that a card cannot become a thread.
  body       TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at  TIMESTAMPTZ
);

-- The only read path there is: every comment on one Moove, oldest first.
CREATE INDEX IF NOT EXISTS plan_comments_plan_idx
  ON public.plan_comments (plan_id, created_at);

ALTER TABLE public.plan_comments ENABLE ROW LEVEL SECURITY;
-- No policies: service-role only, exactly like `plans`. Access is decided in the
-- API against move_joins, which RLS here could not express without duplicating
-- the visibility rules that already live in one place.

-- ⚠ NOT added to the realtime publication, and that is a product decision rather
-- than an omission. Comments fetch when the disclosure opens and on focus. Live
-- appearing messages are what make a surface feel like chat, and this phase is
-- spending its one exception on logistics, not on chat.
