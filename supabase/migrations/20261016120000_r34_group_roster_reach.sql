-- R34 — Sharing a group is a reason to ask someone to be your friend.
--
-- Group rosters now show everyone in the group by name (one person can join via
-- the invite link without being friends with the rest), and each non-friend row
-- offers "Add friend". That button is only honest if the gate behind it agrees:
-- a co-member who is neither one hop out nor a past Moove-mate would otherwise
-- 403. Being in the same group is the same kind of reason the other two are —
-- something a human on the receiving end can evaluate — so it joins them.
--
-- Everything else about the gate is unchanged: not yourself, suggestable, not
-- already a friend.
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
      -- or you are in a group together (owner counts as in it)
      OR EXISTS (
        SELECT 1
        FROM public.groups g
        WHERE (
            g.owner_id = viewer
            OR EXISTS (SELECT 1 FROM public.group_members m
                        WHERE m.group_id = g.id AND m.user_id = viewer)
          )
          AND (
            g.owner_id = target
            OR EXISTS (SELECT 1 FROM public.group_members m
                        WHERE m.group_id = g.id AND m.user_id = target)
          )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_request_friend(uuid, uuid) FROM PUBLIC, anon, authenticated;
