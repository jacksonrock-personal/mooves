-- R31 — suggested friends, and asking properly.
--
-- THE FIRST ACCEPT STEP IN THE APP, AND THE NARROWEST POSSIBLE ONE.
--
-- Friendships have been unilateral and instant since baseline: POST
-- /api/friendships takes a referral code and writes both rows. That is not
-- sloppiness, it is the consent model — it is safe BECAUSE holding the code
-- proves the other person handed you something. The three paths that work that
-- way (invite link, round-up QR, group invite) are untouched by this migration
-- and must stay untouched: an accept step in the middle of onboarding is the
-- one place friction is fatal.
--
-- R31 opens the first path to somebody who handed you nothing, so it builds the
-- accept step for THAT path only.
--
-- OPTION B IS REVISED HERE, ON PURPOSE. It was approved as an instant one-tap
-- add once two people are in the same Moove, reasoning that showing up together
-- is consent. It does not hold: attending a Moove is not agreeing to share when
-- you are free, which is what a friendship hands over. Co-attendance now ranks a
-- suggestion FIRST with the reason attached. It changes the order of the list,
-- never the consent.

-- ── The request ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE (requester_id, recipient_id),
  CHECK (requester_id <> recipient_id)
);

COMMENT ON TABLE public.friend_requests IS
  'R31. A DECLINED ROW IS PERMANENT AND THAT IS THE POINT: it is what removes '
  'that person from the requester''s suggestions for good. There is no cooldown '
  'and no second ask — a "no" that can be re-sent is not a no, and the absence '
  'of any signal back is exactly what makes declining feel free. The moment '
  'declining carries a social cost people stop declining and start ignoring.';

-- RLS on, NO policies: service-role only, same posture as fof_hidden and
-- plan_comments. Nothing subscribes to this table.
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS friend_requests_recipient_idx
  ON public.friend_requests (recipient_id) WHERE status = 'pending';

-- ── The opt-out ──────────────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS friend_suggestable BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.users.friend_suggestable IS
  'R31: may this person be suggested to friends-of-friends. Default true, for '
  'the same reason as fof_mooves_enabled — opt-in leaves the list empty and the '
  'feature pointless. It governs BOTH paths INCLUDING co-attendance: a flag that '
  'quietly stops protecting you the moment you attend something is a trap, not a '
  'setting. Distinct from hide_from_matches, which is about "would probably go" '
  'lines on Discover cards and is a different promise about a different object.';

-- Co-attendance reads move_joins BY PERSON; the plan-first index cannot serve it.
CREATE INDEX IF NOT EXISTS move_joins_joiner_idx
  ON public.move_joins (joiner_id, plan_id);

-- ── The suggestions ──────────────────────────────────────────────────────────
--
-- Computed live, never stored. A stored suggestion list goes stale the moment
-- anybody adds a friend, and refreshing it is a job nobody would remember to do.
--
-- Every suggestion carries a REASON, and the reason outranks the count:
--
--   coAttended     "You were both at Trivia at Emporium"   ranked first, always
--   mutualFriends  "You both know Marcus, Dev and 2 others"  by count, desc
--
-- Co-attendance wins over any number of mutuals because it is the only signal
-- here that is EVIDENCE rather than inference: you were in a room together.
CREATE OR REPLACE FUNCTION public.friend_suggestions(viewer uuid)
RETURNS TABLE (
  id            uuid,
  display_name  text,
  avatar_url    text,
  reason        text,
  co_plan_title text,
  mutual_names  text[],
  mutual_count  int
)
LANGUAGE sql
STABLE
AS $$
WITH friend_ids AS (
  SELECT friend_id AS uid FROM public.friendships WHERE user_id = viewer
),
-- Everyone attached to a Moove, author or joiner. `plan_id IS NOT NULL` is the
-- mandatory green-join filter (Phase 20.3) — a legacy green join carries a NULL
-- plan_id and must never be read as having attended anything.
participants AS (
  SELECT p.id AS plan_id, p.author_id AS uid, p.title, p.start_at
  FROM public.plans p
  WHERE p.cancelled_at IS NULL
  UNION
  SELECT j.plan_id, j.joiner_id, p.title, p.start_at
  FROM public.move_joins j
  JOIN public.plans p ON p.id = j.plan_id
  WHERE j.plan_id IS NOT NULL AND p.cancelled_at IS NULL
),
mine AS (
  SELECT plan_id FROM participants WHERE uid = viewer
),
-- The most RECENT shared Moove per person: "you were both at" wants the one
-- they are most likely to remember, not the first one that happens to sort.
co AS (
  SELECT DISTINCT ON (pt.uid) pt.uid AS cand, pt.title
  FROM participants pt
  JOIN mine m ON m.plan_id = pt.plan_id
  WHERE pt.uid <> viewer
  ORDER BY pt.uid, pt.start_at DESC
),
-- Second degree, with the bridges named. Ordered by how long you have known
-- them, matching R29's "through Marcus" rule: the friend you have had longest
-- is the most useful voucher.
mutual AS (
  SELECT
    f2.friend_id AS cand,
    count(*)::int AS n,
    (array_agg(u.display_name ORDER BY f1.created_at ASC)
       FILTER (WHERE u.display_name IS NOT NULL))[1:3] AS names
  FROM public.friendships f1
  JOIN public.friendships f2 ON f2.user_id = f1.friend_id
  JOIN public.users u ON u.id = f1.friend_id
  WHERE f1.user_id = viewer AND f2.friend_id <> viewer
  GROUP BY f2.friend_id
),
candidates AS (
  SELECT cand FROM co
  UNION
  SELECT cand FROM mutual
)
SELECT
  u.id,
  u.display_name,
  u.avatar_url,
  CASE WHEN co.cand IS NOT NULL THEN 'coAttended' ELSE 'mutualFriends' END,
  co.title,
  COALESCE(m.names, ARRAY[]::text[]),
  COALESCE(m.n, 0)
FROM candidates c
JOIN public.users u ON u.id = c.cand
LEFT JOIN co ON co.cand = c.cand
LEFT JOIN mutual m ON m.cand = c.cand
WHERE u.friend_suggestable
  AND u.id <> viewer
  AND NOT EXISTS (SELECT 1 FROM friend_ids f WHERE f.uid = u.id)
  -- Any request in EITHER direction and ANY status disqualifies. Pending means
  -- it is already asked; accepted is unreachable (they would be a friend);
  -- declined is the permanent no.
  AND NOT EXISTS (
    SELECT 1 FROM public.friend_requests r
    WHERE (r.requester_id = viewer AND r.recipient_id = u.id)
       OR (r.requester_id = u.id AND r.recipient_id = viewer)
  )
  -- Hiding someone's Mooves and wanting them suggested are not states that
  -- coexist.
  AND NOT EXISTS (
    SELECT 1 FROM public.fof_hidden h
    WHERE h.user_id = viewer AND h.hidden_user_id = u.id
  )
ORDER BY (co.cand IS NOT NULL) DESC, COALESCE(m.n, 0) DESC, u.id
LIMIT 10;
$$;

REVOKE ALL ON FUNCTION public.friend_suggestions(uuid) FROM PUBLIC, anon, authenticated;

-- ── Reachability ─────────────────────────────────────────────────────────────
--
-- The guard on POST /api/friend-requests. Without it that route is a channel for
-- reaching ANY user id in the database, which is a worse hole than the one R31
-- exists to close — and it would arrive wearing a consent step, which is how it
-- would go unnoticed.
--
-- Deliberately NOT the same query as friend_suggestions: that one excludes
-- anybody you have already asked, which is correct for a list and wrong for a
-- gate. This answers only "is this person within reach at all".
CREATE OR REPLACE FUNCTION public.can_request_friend(viewer uuid, target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    viewer <> target
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = target AND u.friend_suggestable)
    AND NOT EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.user_id = viewer AND f.friend_id = target
    )
    AND (
      -- one hop out
      EXISTS (
        SELECT 1
        FROM public.friendships f1
        JOIN public.friendships f2 ON f2.user_id = f1.friend_id
        WHERE f1.user_id = viewer AND f2.friend_id = target
      )
      -- or you have been in a Moove together
      OR EXISTS (
        SELECT 1
        FROM public.plans p
        WHERE p.cancelled_at IS NULL
          AND (
            p.author_id = viewer
            OR EXISTS (SELECT 1 FROM public.move_joins j
                        WHERE j.plan_id = p.id AND j.joiner_id = viewer)
          )
          AND (
            p.author_id = target
            OR EXISTS (SELECT 1 FROM public.move_joins j
                        WHERE j.plan_id = p.id AND j.joiner_id = target)
          )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_request_friend(uuid, uuid) FROM PUBLIC, anon, authenticated;
