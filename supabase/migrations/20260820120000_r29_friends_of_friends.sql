-- R29 — Mooves that open one hop out.
--
-- THE LOAD-BEARING CONSTRAINT: Mooves can open one hop out, greens NEVER can,
-- and `get_feed` is not touched by this migration. A green is "when I am free
-- and roughly where I am" — continuous, passive, attached to a person. A Moove
-- is a thing at a time and a place. Only the second is safe to widen, and
-- keeping that line bright is what makes the rest of this round safe at all.
--
-- The rejected alternative was transitive auto-friending, which collapses:
-- second degree is ~d-squared, third ~d-cubed, so at fifteen friends you are at
-- whole-app scale by hop three. The fatal part is not the size but what it does
-- to the signal — the green ring means something BECAUSE it is someone you
-- would actually text.
--
-- Four ways this arm can be shut off, and a row has to clear all of them:
--   the author must have opened that specific Moove   (plans.open_to_fof)
--   the viewer must accept them at all                (users.fof_mooves_enabled)
--   the viewer must not have hidden that author       (fof_hidden)
--   the Moove must not be scoped to a group or person (checked here AND on write)

-- ── The toggle, per Moove ────────────────────────────────────────────────────
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS open_to_fof BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.plans.open_to_fof IS
  'R29: this Moove is visible one hop out. Default false, so nothing already '
  'posted changes audience when this ships. Mutually exclusive with visible_to '
  'and visible_user_ids — narrowing and widening cannot both be true, and the '
  'write path REJECTS the combination rather than resolving it.';

-- ── The viewer's switch ──────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS fof_mooves_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.users.fof_mooves_enabled IS
  'R29: show me Mooves from friends of friends. Default TRUE — off-by-default '
  'would leave adoption near zero and the feed exactly as it is, which is the '
  'problem this round exists to solve.';

-- ── The pressure valve ───────────────────────────────────────────────────────
--
-- This table is load-bearing because Mooves has no blocking. Unfriending is
-- real and works, but it is unavailable here BY DEFINITION: you were never
-- friends. Without this the only escape is the global switch, which kills the
-- feature entirely, or unfriending the bridge, which punishes someone who did
-- nothing.
--
-- One-directional on purpose. Hiding someone is not a fact about them and they
-- are never told, so there is no second row and nothing to keep in sync.
CREATE TABLE IF NOT EXISTS public.fof_hidden (
  user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  hidden_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, hidden_user_id),
  CHECK (user_id <> hidden_user_id)
);

-- RLS on, NO policies: deny-all to anon and authenticated, service client only.
-- Same posture as sponsored_moves and plan_comments, and for the same reason —
-- nothing subscribes to this table, so a policy would only be a second place
-- for the rule to live.
ALTER TABLE public.fof_hidden ENABLE ROW LEVEL SECURITY;

-- The one-hop join reads the graph in the non-PK direction (friend_id first),
-- which the primary key on (user_id, friend_id) cannot serve.
CREATE INDEX IF NOT EXISTS friendships_reverse_idx
  ON public.friendships (friend_id, user_id);

-- ── get_plans ────────────────────────────────────────────────────────────────
--
-- Re-emitted from the LIVE definition (20260819170000), per the lesson written
-- into 20260819150000: this function is redefined wholesale by every migration
-- that touches it, and a redefinition silently drops whatever the last one
-- added. Read the live body before redefining; do not trust the last migration
-- that mentions it.

CREATE OR REPLACE FUNCTION public.get_plans(viewer uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
WITH friend_ids AS (
  SELECT friend_id AS id FROM public.friendships WHERE user_id = viewer
),
my_groups AS (
  SELECT group_id FROM public.viewer_group_ids(viewer)
),
-- R29 ── everything from here to `visible` is the one-hop arm ────────────────
--
-- Unchanged: the first-degree rule below. It is lifted verbatim and only
-- renamed, so a Moove from a friend reaches you by exactly the path it always
-- did and this migration cannot have altered it by accident.
first_degree AS (
  SELECT p.*, NULL::text AS via_name
  FROM public.plans p
  WHERE p.cancelled_at IS NULL
    AND p.expires_at > now()
    AND (p.author_id = viewer OR p.author_id IN (SELECT id FROM friend_ids))
    AND (
      p.author_id = viewer
      -- R16: unscoped means NEITHER a group nor a named friend was picked.
      OR (p.visible_to IS NULL AND p.visible_user_ids IS NULL)
      OR EXISTS (SELECT 1 FROM my_groups mg WHERE mg.group_id = ANY(p.visible_to))
      OR viewer = ANY(p.visible_user_ids)
    )
),
-- The viewer's own switch. Off, `fof` is empty and every CTE below collapses to
-- nothing, so the whole arm costs one boolean read and the feed is byte-for-byte
-- what it was before R29.
fof_on AS (
  SELECT COALESCE(u.fof_mooves_enabled, true) AS enabled
  FROM public.users u WHERE u.id = viewer
),
-- People exactly one hop out: friends of my friends who are NOT my friends.
--
-- `mutuals` is how many of my friends know them, and it is the ranker — it is
-- the same quantity as "how likely is this to be my scene". `via_name` is the
-- bridge I have known LONGEST (R29.3): deterministic, stable between renders,
-- and the most useful vouch, because it is the person I know best.
fof AS (
  SELECT
    f2.friend_id AS author_id,
    count(*)     AS mutuals,
    (
      SELECT u.display_name
      FROM public.friendships fb
      JOIN public.users u ON u.id = fb.friend_id
      WHERE fb.user_id = viewer
        AND EXISTS (
          SELECT 1 FROM public.friendships fx
          WHERE fx.user_id = fb.friend_id AND fx.friend_id = f2.friend_id
        )
      ORDER BY fb.created_at ASC
      LIMIT 1
    ) AS via_name
  FROM public.friendships f1
  JOIN public.friendships f2 ON f2.user_id = f1.friend_id
  WHERE (SELECT enabled FROM fof_on)
    AND f1.user_id = viewer
    AND f2.friend_id <> viewer
    AND f2.friend_id NOT IN (SELECT id FROM friend_ids)
    AND NOT EXISTS (
      SELECT 1 FROM public.fof_hidden h
      WHERE h.user_id = viewer AND h.hidden_user_id = f2.friend_id
    )
  GROUP BY f2.friend_id
),
-- CAPPED AT FIVE, and the cap is not a nicety. Second degree at fifteen friends
-- is ~225 people; uncapped, a feature that WORKS turns the feed into a listings
-- site and buries the friend Mooves that are the point.
--
-- Scoping is refused here as well as in the write path. A Moove narrowed to a
-- group or to named people can never appear on this arm no matter what
-- `open_to_fof` says, so a row that somehow carried both could not leak.
fof_plans AS (
  SELECT p.*, f.via_name
  FROM public.plans p
  JOIN fof f ON f.author_id = p.author_id
  WHERE p.cancelled_at IS NULL
    AND p.expires_at > now()
    AND p.open_to_fof = true
    AND p.visible_to IS NULL
    AND p.visible_user_ids IS NULL
  ORDER BY f.mutuals DESC, p.start_at ASC
  LIMIT 5
),
-- UNION ALL, not UNION: the two arms are disjoint by construction (the one-hop
-- arm excludes everyone in friend_ids), and ALL keeps Postgres from paying for
-- a dedupe pass that can never remove a row.
visible AS (
  SELECT * FROM first_degree
  UNION ALL
  SELECT * FROM fof_plans
),
pj AS (
  SELECT plan_id, joiner_id
  FROM public.move_joins
  WHERE plan_id IN (SELECT id FROM visible)
),
ji AS (
  SELECT id, display_name, avatar_url, phone
  FROM public.users
  WHERE id IN (SELECT DISTINCT joiner_id FROM pj)
)
SELECT COALESCE(jsonb_agg(x ORDER BY sort_at ASC), '[]'::jsonb)
FROM (
  SELECT
    v.start_at AS sort_at,
    jsonb_build_object(
      'id',           v.id,
      'authorId',     v.author_id,
      'authorName',   (SELECT display_name FROM public.users WHERE id = v.author_id),
      'authorAvatar', (SELECT avatar_url   FROM public.users WHERE id = v.author_id),
      'title',        v.title,
      'startAt',      v.start_at,
      'hasTime',      v.has_time,
      'timeMode',     v.time_mode,
      'locationText', v.location_text,
      'note',         v.note,
      'isMine',       v.author_id = viewer,
      'sponsorBrand', (
        SELECT sm.brand FROM public.sponsored_moves sm WHERE sm.id = v.sponsored_move_id
      ),
      'visibleGroups', (
        SELECT COALESCE(jsonb_agg(g.name ORDER BY g.name), '[]'::jsonb)
        FROM public.groups g
        WHERE v.show_groups = true
          AND v.visible_to IS NOT NULL
          AND g.id = ANY(v.visible_to)
          AND g.id IN (SELECT group_id FROM my_groups)
      ),
      'joiners', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                 'id', u.id, 'displayName', u.display_name, 'avatarUrl', u.avatar_url,
                 'phone', CASE WHEN v.author_id = viewer THEN u.phone ELSE NULL END)), '[]'::jsonb)
        FROM pj j JOIN ji u ON u.id = j.joiner_id
        WHERE j.plan_id = v.id
      ),
      'joinedByMe', EXISTS (SELECT 1 FROM pj j WHERE j.plan_id = v.id AND j.joiner_id = viewer),
      -- R28: no longer gated on having joined. Anyone reading this row is
      -- already inside the `visible` CTE, i.e. already in the Moove's audience,
      -- and the audience is exactly who may now open the thread. The old CASE
      -- returned 0 to non-joiners so the count could not hint that a private
      -- conversation existed; with the thread open to the same people, a zero
      -- would just be a lie about a tab they can tap.
      'commentCount', (
        SELECT count(*) FROM public.plan_comments c WHERE c.plan_id = v.id
      ),
      'visibleTo', (
        SELECT CASE WHEN v.author_id = viewer
          THEN COALESCE(to_jsonb(v.visible_to), 'null'::jsonb)
          ELSE 'null'::jsonb
        END
      ),
      -- R16, author only, same rule as visibleTo above and for the same reason:
      -- without it the edit composer cannot know who the Moove is scoped to, and
      -- would write its guess back over the truth (the R12 bug, exactly).
      'visibleUserIds', (
        SELECT CASE WHEN v.author_id = viewer
          THEN COALESCE(to_jsonb(v.visible_user_ids), 'null'::jsonb)
          ELSE 'null'::jsonb
        END
      ),
      'showGroups', (v.author_id = viewer AND v.show_groups),
      -- R29. NULL on a first-degree Moove, which is what the card branches on:
      -- the chip is drawn if and only if there is a name to put in it.
      'viaName',    v.via_name,
      -- Author only, same rule and same reason as visibleTo above — without it
      -- the edit composer cannot know the Moove is open and would write its
      -- guess back over the truth.
      'openToFof',  (v.author_id = viewer AND v.open_to_fof)
    ) AS x
  FROM visible v
) rows;
$$;
