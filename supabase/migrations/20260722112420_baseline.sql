-- ─────────────────────────────────────────────────────────────────────────────
-- 0000 — baseline (RECONSTRUCTED — see note below)
--
-- The pre-existing database state BEFORE migration 0001, rebuilt from:
--   • the original supabase/schema.sql (users/friendships/groups/group_members)
--   • src/types/database.ts (generated from the live DB — authoritative for
--     columns, types, nullability, and FK relationships)
--   • app behavior (unique constraints required by upserts, delete cascades
--     implied by account deletion, etc.)
--
-- NOT a literal pg_dump. Anything guessed is marked INFERRED. If you ever run
-- `supabase db dump` (or pg_dump) against prod, prefer that output over this.
-- Replaying 0000 → 0005 in order should reproduce the current database.
-- ─────────────────────────────────────────────────────────────────────────────


-- ══ helper: referral code generator ══════════════════════════════════════════

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


-- ══ USERS ════════════════════════════════════════════════════════════════════
-- Firebase Auth is the identity layer; id is a plain UUID (no FK to auth.users).

CREATE TABLE IF NOT EXISTS public.users (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone                TEXT        UNIQUE NOT NULL,
  display_name         TEXT        CHECK (char_length(display_name) <= 30),
  avatar_url           TEXT,
  referral_code        VARCHAR(8)  UNIQUE NOT NULL DEFAULT generate_referral_code(),
  is_available         BOOLEAN     NOT NULL DEFAULT FALSE,
  status_note          TEXT        CHECK (char_length(status_note) <= 60),
  status_time          TEXT,                            -- Phase 9 time chip ("now", "tonight", …)
  status_move_id       UUID,                            -- FK added below (needs sponsored_moves)
  visible_to           UUID[]      DEFAULT NULL,        -- NULL = visible to all friends
  status_set_at        TIMESTAMPTZ,
  onboarding_complete  BOOLEAN     NOT NULL DEFAULT FALSE,
  is_admin             BOOLEAN     NOT NULL DEFAULT FALSE,
  area_zip             TEXT,                            -- Phase 12 coarse area
  interests            TEXT[],                          -- Phase 13/16 interest slugs
  last_active_at       TIMESTAMPTZ,                     -- Phase 10 ambient signals
  last_green_at        TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_referral_code ON public.users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_phone         ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_is_available  ON public.users(is_available) WHERE is_available = TRUE;


-- ══ FRIENDSHIPS ══════════════════════════════════════════════════════════════
-- Mutual model: both A→B and B→A rows exist for every friendship.

CREATE TABLE IF NOT EXISTS public.friendships (
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  friend_id  UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id <> friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON public.friendships(user_id);


-- ══ GROUPS ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.groups (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL CHECK (char_length(name) <= 40),
  emoji            TEXT        NOT NULL DEFAULT '👥',
  invite_code      TEXT        UNIQUE,                  -- Phase 10 invite links (UNIQUE: INFERRED)
  last_notified_at TIMESTAMPTZ,                         -- Phase 15 push rate-limit floor
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_groups_owner_id ON public.groups(owner_id);


-- ══ GROUP MEMBERS ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.group_members (
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id  ON public.group_members(user_id);


-- ══ SPONSORS (Phase 13) ══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.sponsors (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone                     TEXT        UNIQUE NOT NULL,   -- one sponsor per phone (UNIQUE: INFERRED from lookup-by-phone)
  business_name             TEXT,
  email                     TEXT,
  stripe_customer_id        TEXT,
  default_payment_method_id TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ══ SPONSORED MOVES (Phase 13) ═══════════════════════════════════════════════
-- sponsor_id has NO FK in the live DB (generated types show no relationship).
-- NULL sponsor_id = Mooves-authored (concierge) move.

CREATE TABLE IF NOT EXISTS public.sponsored_moves (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id                UUID,
  title                     TEXT        NOT NULL,
  description               TEXT        NOT NULL,
  category                  TEXT        NOT NULL,
  brand                     TEXT,
  area_zip                  TEXT        NOT NULL,
  radius_miles              INTEGER     NOT NULL DEFAULT 25,
  link_url                  TEXT,
  image_url                 TEXT,
  time_text                 TEXT,
  start_at                  TIMESTAMPTZ,                 -- type INFERRED (app sends ISO datetimes)
  location_text             TEXT,
  status                    TEXT        NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  reject_reason             TEXT,
  paid_at                   TIMESTAMPTZ,
  price_cents               INTEGER,
  stripe_payment_intent_id  TEXT,
  impressions               INTEGER     NOT NULL DEFAULT 0,
  clicks                    INTEGER     NOT NULL DEFAULT 0,
  interested_count          INTEGER     NOT NULL DEFAULT 0,
  brought_over_count        INTEGER     NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sponsored_moves_status_area ON public.sponsored_moves(status, area_zip);  -- INFERRED (discover query)

-- users.status_move_id → sponsored_moves (deferred until both tables exist).
-- ON DELETE SET NULL: INFERRED (deleting a move shouldn't delete/blocked-by a user).
ALTER TABLE public.users
  ADD CONSTRAINT users_status_move_id_fkey
  FOREIGN KEY (status_move_id) REFERENCES public.sponsored_moves(id) ON DELETE SET NULL;


-- ══ MOVE INTERESTED (Phase 13) ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.move_interested (
  move_id    UUID        NOT NULL REFERENCES public.sponsored_moves(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (move_id, user_id)
);


-- ══ MOVE JOINS (Phase 9 presence) ════════════════════════════════════════════
-- PK (mover_id, joiner_id) — re-joining is an idempotent upsert on this pair.

CREATE TABLE IF NOT EXISTS public.move_joins (
  mover_id   UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joiner_id  UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (mover_id, joiner_id)
);


-- ══ PUSH SUBSCRIPTIONS (Phase 15) ════════════════════════════════════════════
-- fcm_token UNIQUE is load-bearing: the subscribe route upserts ON CONFLICT (fcm_token).

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  fcm_token    TEXT        UNIQUE NOT NULL,
  platform     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);


-- ══ GROUP NOTIFICATION MUTES (Phase 15) ══════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.group_notification_mutes (
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  group_id   UUID        NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, group_id)
);


-- ══ TIPS (Phase 14.1) ════════════════════════════════════════════════════════
-- stripe_payment_intent_id UNIQUE is load-bearing: the webhook upserts on it for
-- idempotency. user_id ON DELETE SET NULL: INFERRED (keep the money ledger even
-- if the account is deleted).

CREATE TABLE IF NOT EXISTS public.tips (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  amount_cents              INTEGER     NOT NULL,
  stripe_payment_intent_id  TEXT        UNIQUE NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ══ ROW LEVEL SECURITY (pre-0001 state: only the original four tables) ═══════

ALTER TABLE public.users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "users_select_friends" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.friendships
      WHERE user_id = auth.uid() AND friend_id = users.id
    )
  );

CREATE POLICY "friendships_select_own" ON public.friendships
  FOR SELECT USING (user_id = auth.uid() OR friend_id = auth.uid());

CREATE POLICY "groups_owner_all" ON public.groups
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "group_members_owner_all" ON public.group_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE id = group_members.group_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "group_members_select_self" ON public.group_members
  FOR SELECT USING (user_id = auth.uid());

-- (RLS for the other seven tables arrives in migration 0001.)


-- ══ REALTIME ═════════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
-- (move_joins is added to the publication in migration 0001, guarded.)
