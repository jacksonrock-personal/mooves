-- ─────────────────────────────────────────────────────────────────────────────
-- R35 — Add a Moove to your calendar
--
-- Mooves does not become a calendar. It EXPORTS to the one you already use, the
-- same move as the group-text handoff: the logistics leave the app. Two columns
-- carry the whole feature; there are no new tables.
--
-- users.calendar_token — the random half of the subscribe URL that calendar
--   apps poll (GET /api/cal/<token>.ics). Calendar apps cannot log in, so the
--   URL itself is the credential. Nullable: null means "sync never set up".
--   Minted on first setup, replaced by Reset, which is what makes the old URL
--   404. UNIQUE because the feed route looks a user up by it.
--
--   NOT the whole credential, on purpose. public.users is readable by friends
--   (users_select_friends) and its UPDATEs fan out over the feed's realtime
--   subscription, so anything stored here should be assumed visible to them.
--   The URL therefore carries this value PLUS an HMAC tag only the server can
--   compute (src/lib/calendarServer.ts). A friend who reads this column still
--   cannot build a working feed URL.
--
-- users.calendar_prompted_at — the one-time "Put your Mooves on your calendar?"
--   ask after a join. Once per account, ever: non-null means it has been spent,
--   and nothing ever clears it.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS calendar_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS calendar_prompted_at timestamptz;
