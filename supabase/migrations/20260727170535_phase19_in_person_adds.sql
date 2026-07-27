-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 19 — In-person adds ("Add everyone here")
--
-- A short-lived session that mutually friends everyone who scans one QR code,
-- and creates NO group. Nothing survives the session except friendships.
--
-- Naming note: the UI is deliberately verb-only ("Add everyone here", "4 joined",
-- "Done") and never shows a noun. `roundup` exists only in code and SQL, where a
-- noun is unavoidable. It must not leak into user-facing copy.
--
-- Bounds (spec): host closes manually · auto-expires 24h after opening ·
-- cap 25 INCLUDING the host · one open session per host at a time.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.roundups (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT        UNIQUE NOT NULL,
  host_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  closed_at  TIMESTAMPTZ
);

-- "One open session per host." Partial unique index, so closed sessions never
-- block a new one. The start route closes any stale/expired open session first,
-- which is what keeps this from rejecting a host whose last session timed out.
CREATE UNIQUE INDEX IF NOT EXISTS roundups_one_open_per_host
  ON public.roundups (host_id) WHERE closed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.roundup_members (
  roundup_id UUID        NOT NULL REFERENCES public.roundups(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Exactly which friendships THIS join created, so Undo can remove those and
  -- never a friendship the joiner already had. Empty array = joined but was
  -- already friends with everyone present (Undo then has nothing to remove).
  new_friend_ids UUID[]  NOT NULL DEFAULT '{}',
  PRIMARY KEY (roundup_id, user_id)
);

CREATE INDEX IF NOT EXISTS roundup_members_user_idx
  ON public.roundup_members (user_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Both tables are service-role-only for writes. roundup_members carries one
-- scoped SELECT policy purely so the HOST's live roster can arrive over
-- Realtime. Note this is deliberately NOT `USING (true)`: the roster is the
-- exact thing the consent landing withholds, so only the host of that session
-- may read its rows.
ALTER TABLE public.roundups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roundup_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS roundup_members_select_host ON public.roundup_members;
CREATE POLICY roundup_members_select_host ON public.roundup_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.roundups r
      WHERE r.id = roundup_members.roundup_id
        AND r.host_id = auth.uid()
    )
  );

-- Realtime delivery for that roster. Guarded so it no-ops if already present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'roundup_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.roundup_members;
  END IF;
END $$;

-- ── Join, as one atomic operation ────────────────────────────────────────────
-- Cap enforcement, membership, and the mutual friend fan-out have to happen
-- together or the cap is racy (two simultaneous scans could both see 24). Doing
-- it in SQL also lets ON CONFLICT DO NOTHING tell us precisely which friendships
-- were NEW, which is what Undo needs.
--
-- Returns one row: status ∈ (joined | already | full | expired | invalid),
-- plus the resulting member count and how many people were newly connected.
CREATE OR REPLACE FUNCTION public.roundup_join(p_code TEXT, p_user UUID)
RETURNS TABLE(status TEXT, member_count INT, connected_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_roundup   public.roundups%ROWTYPE;
  v_existing  UUID[];
  v_new       UUID[];
  v_count     INT;
BEGIN
  -- Lock the session row so concurrent scans serialize on the cap check.
  SELECT * INTO v_roundup FROM public.roundups WHERE code = p_code FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::TEXT, 0, 0;
    RETURN;
  END IF;

  IF v_roundup.closed_at IS NOT NULL OR v_roundup.expires_at <= NOW() THEN
    RETURN QUERY SELECT 'expired'::TEXT, 0, 0;
    RETURN;
  END IF;

  SELECT COALESCE(array_agg(user_id), '{}'::UUID[]) INTO v_existing
  FROM public.roundup_members WHERE roundup_id = v_roundup.id;

  IF p_user = ANY(v_existing) THEN
    RETURN QUERY SELECT 'already'::TEXT, COALESCE(array_length(v_existing, 1), 0), 0;
    RETURN;
  END IF;

  -- Cap counts everyone in the session, host included (the host is a member).
  IF COALESCE(array_length(v_existing, 1), 0) >= 25 THEN
    RETURN QUERY SELECT 'full'::TEXT, COALESCE(array_length(v_existing, 1), 0), 0;
    RETURN;
  END IF;

  -- Mutual friendships with everyone already here. RETURNING tells us which
  -- rows actually landed, so pre-existing friendships are left out of Undo.
  WITH pairs AS (
    SELECT p_user AS user_id, other AS friend_id FROM unnest(v_existing) AS other
    UNION ALL
    SELECT other AS user_id, p_user AS friend_id FROM unnest(v_existing) AS other
  ),
  inserted AS (
    INSERT INTO public.friendships (user_id, friend_id)
    SELECT user_id, friend_id FROM pairs
    ON CONFLICT (user_id, friend_id) DO NOTHING
    RETURNING user_id, friend_id
  )
  SELECT COALESCE(array_agg(DISTINCT friend_id), '{}'::UUID[]) INTO v_new
  FROM inserted WHERE user_id = p_user;

  INSERT INTO public.roundup_members (roundup_id, user_id, new_friend_ids)
  VALUES (v_roundup.id, p_user, v_new);

  SELECT count(*)::INT INTO v_count
  FROM public.roundup_members WHERE roundup_id = v_roundup.id;

  RETURN QUERY SELECT 'joined'::TEXT, v_count, COALESCE(array_length(v_existing, 1), 0);
END;
$$;

-- ── Undo ─────────────────────────────────────────────────────────────────────
-- Removes only friendships THIS session created for this user, in both
-- directions, and drops their membership so later joiners no longer connect to
-- them. Covers both sides: people they friended on the way in, and people who
-- joined afterwards and listed them as newly friended.
CREATE OR REPLACE FUNCTION public.roundup_undo(p_code TEXT, p_user UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_roundup_id UUID;
  v_others     UUID[];
  v_removed    INT;
BEGIN
  SELECT id INTO v_roundup_id FROM public.roundups WHERE code = p_code;
  IF v_roundup_id IS NULL THEN RETURN 0; END IF;

  SELECT COALESCE(array_agg(DISTINCT x), '{}'::UUID[]) INTO v_others
  FROM (
    SELECT unnest(new_friend_ids) AS x
    FROM public.roundup_members
    WHERE roundup_id = v_roundup_id AND user_id = p_user
    UNION
    SELECT user_id AS x
    FROM public.roundup_members
    WHERE roundup_id = v_roundup_id
      AND user_id <> p_user
      AND p_user = ANY(new_friend_ids)
  ) s;

  IF COALESCE(array_length(v_others, 1), 0) = 0 THEN
    DELETE FROM public.roundup_members
    WHERE roundup_id = v_roundup_id AND user_id = p_user;
    RETURN 0;
  END IF;

  WITH removed AS (
    DELETE FROM public.friendships
    WHERE (user_id = p_user   AND friend_id = ANY(v_others))
       OR (friend_id = p_user AND user_id   = ANY(v_others))
    RETURNING 1
  )
  SELECT count(*)::INT INTO v_removed FROM removed;

  DELETE FROM public.roundup_members
  WHERE roundup_id = v_roundup_id AND user_id = p_user;

  -- Two rows per friendship; report people, not rows.
  RETURN COALESCE(v_removed, 0) / 2;
END;
$$;

REVOKE ALL ON FUNCTION public.roundup_join(TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.roundup_undo(TEXT, UUID) FROM PUBLIC, anon, authenticated;
