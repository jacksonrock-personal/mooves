-- ─────────────────────────────────────────────────────────────────────────────
-- R26 — every day offers a morning.
--
-- Phase 22 withheld weekday mornings deliberately. Jackson's call reverses it:
-- morning is now settable on all seven days.
--
-- That forces a second change, because the two windows OVERLAP. The old parts
-- were morning 08–12 and day 09–17, which share three hours — offer both on the
-- same row and the grid has two cells claiming the same time, which is not a
-- grid anybody can read. So the parts become three, uniform and disjoint:
--
--     morning 08–12  ·  day 12–17  ·  evening 17–23
--
-- `day` NARROWS from 09–17 to 12–17, and `afternoon` FOLDS INTO IT. That
-- direction rather than the other because "Morning / Day / Evening" is the
-- vocabulary already on screen in R25's strip, and it now means the same window
-- every day of the week — which retires the caveat R25 shipped with, that its
-- middle row silently meant "afternoon" at weekends.
--
-- WHY THIS IS SAFE TO FOLD RATHER THAN KEEP:
--   · `day` has never been used. Zero rows, ever — which is its own verdict on
--     a 09–17 weekday slot, and means the fold cannot collide with itself.
--   · `afternoon` was 8 rows across 4 beta users at the time of writing.
--   · The two windows are now identical, so no user's stated availability moves
--     by a single minute. This is a rename of live data, not a reinterpretation.
--
-- The CHECK constraint KEEPS 'afternoon'. The column is not an enum and there is
-- no value in narrowing it: a row written by a client that has not reloaded yet
-- must land rather than 500, and the app reads 'afternoon' as an alias for
-- 'day' with the same window. Nothing writes it after this migration.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── afternoon → day ──────────────────────────────────────────────────────────
-- The unique index is (user_id, slot_date, part), so a user holding BOTH
-- 'afternoon' and 'day' on one date would collide on update. There are no 'day'
-- rows today, so this cannot happen — but the guard costs one clause and this
-- migration must stay re-runnable, at which point it very much can.
--
-- Drop the losers first, then rename the survivors.
DELETE FROM public.availability_slots a
WHERE a.part = 'afternoon'
  AND EXISTS (
    SELECT 1 FROM public.availability_slots b
    WHERE b.user_id = a.user_id
      AND b.slot_date = a.slot_date
      AND b.part = 'day'
  );

UPDATE public.availability_slots
SET part = 'day'
WHERE part = 'afternoon';

COMMENT ON COLUMN public.availability_slots.part IS
  'R26: morning 08-12, day 12-17, evening 17-23, offered on ALL seven days. '
  '"afternoon" is legacy, folded into "day" (identical window) and never written '
  'again; it stays in the CHECK so an in-flight write from a stale client lands.';
