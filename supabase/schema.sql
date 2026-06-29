-- ─────────────────────────────────────────────────────────────────────────────
-- Mooves — complete database schema
-- Run this in Supabase: SQL Editor → New query → paste → Run
--
-- Auth note: we use Firebase Phone Auth (not Supabase Auth).
-- users.id is a plain UUID we generate server-side — no FK to auth.users.
-- RLS still works: our server mints a Supabase-compatible JWT with the user's
-- UUID as `sub`, so auth.uid() resolves correctly in all policies.
-- ─────────────────────────────────────────────────────────────────────────────


-- ══════════════════════════════════════════════════════════════════════════════
-- HELPER FUNCTION: referral code generator
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no ambiguous chars (0,O,1,I)
  code  TEXT := '';
  i     INT;
BEGIN
  FOR i IN 1..8 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;


-- ══════════════════════════════════════════════════════════════════════════════
-- USERS
-- id is a UUID we generate server-side in /api/auth/verify.
-- No FK to auth.users — Firebase Auth is the identity layer, not Supabase Auth.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.users (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone                TEXT        UNIQUE NOT NULL,
  display_name         TEXT        CHECK (char_length(display_name) <= 30),
  avatar_url           TEXT,
  referral_code        VARCHAR(8)  UNIQUE NOT NULL DEFAULT generate_referral_code(),
  is_available         BOOLEAN     NOT NULL DEFAULT FALSE,
  status_note          TEXT        CHECK (char_length(status_note) <= 60),
  visible_to           UUID[]      DEFAULT NULL,  -- NULL = visible to all friends
  status_set_at        TIMESTAMPTZ,
  onboarding_complete  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for referral code lookups (invite landing page)
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON public.users(referral_code);
-- Index for phone lookups (SMS feed check + /api/auth/verify)
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
-- Index for feed queries (find green friends fast)
CREATE INDEX IF NOT EXISTS idx_users_is_available ON public.users(is_available) WHERE is_available = TRUE;


-- ══════════════════════════════════════════════════════════════════════════════
-- FRIENDSHIPS
-- Mutual model: both A→B and B→A rows exist for every friendship.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.friendships (
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  friend_id  UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id <> friend_id)  -- no self-friending
);

CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON public.friendships(user_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- GROUPS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.groups (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL CHECK (char_length(name) <= 40),
  emoji      TEXT        NOT NULL DEFAULT '👥',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_groups_owner_id ON public.groups(owner_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- GROUP MEMBERS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.group_members (
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id  ON public.group_members(user_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- auth.uid() reads the `sub` claim from the JWT we mint in /api/auth/verify.
-- That JWT is signed with SUPABASE_JWT_SECRET so Supabase trusts it.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;


-- ─── USERS policies ──────────────────────────────────────────────────────────

-- Users can read and update their own row
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can read their friends' rows (feed + people tab)
CREATE POLICY "users_select_friends" ON public.users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.friendships
      WHERE user_id = auth.uid() AND friend_id = users.id
    )
  );

-- Insert and delete handled server-side via service role only.


-- ─── FRIENDSHIPS policies ─────────────────────────────────────────────────────

CREATE POLICY "friendships_select_own" ON public.friendships
  FOR SELECT
  USING (user_id = auth.uid() OR friend_id = auth.uid());

-- Insert/delete via service role in API routes only.


-- ─── GROUPS policies ──────────────────────────────────────────────────────────

CREATE POLICY "groups_owner_all" ON public.groups
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());


-- ─── GROUP MEMBERS policies ───────────────────────────────────────────────────

CREATE POLICY "group_members_owner_all" ON public.group_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE id = group_members.group_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "group_members_select_self" ON public.group_members
  FOR SELECT
  USING (user_id = auth.uid());


-- ══════════════════════════════════════════════════════════════════════════════
-- REALTIME
-- ══════════════════════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
