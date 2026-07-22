-- ─────────────────────────────────────────────────────────────────────────────
-- 0001 — RLS + storage lockdown  (STATUS: applied)
-- Six tables are service-role-only → enable RLS with NO policy (default deny).
-- move_joins is the exception: the feed's realtime subscription needs SELECT.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Service-role-only tables: default-deny locks the public anon key out ──────
ALTER TABLE public.sponsors                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsored_moves           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tips                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.move_interested           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_notification_mutes  ENABLE ROW LEVEL SECURITY;
-- (No policies created → these are readable/writable only via the service role.)

-- ── move_joins: RLS on, plus a SELECT policy for feed realtime ────────────────
ALTER TABLE public.move_joins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS move_joins_select_visible ON public.move_joins;
CREATE POLICY move_joins_select_visible ON public.move_joins
  FOR SELECT USING (
    joiner_id = auth.uid()
    OR mover_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.friendships
      WHERE user_id = auth.uid() AND friend_id = move_joins.mover_id
    )
  );

-- move_joins must be in the realtime publication for the feed subscription to
-- receive changes. Guarded so it no-ops if it was already added in the dashboard.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'move_joins'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.move_joins;
  END IF;
END $$;

-- ── Storage: scope Avatars writes to the owner's own folder ───────────────────
-- Path convention is `${uid}/avatar.{jpg|png}`; foldername[1] must equal the uid.
DROP POLICY IF EXISTS avatars_public_read ON storage.objects;
CREATE POLICY avatars_public_read ON storage.objects
  FOR SELECT USING (bucket_id = 'Avatars');

DROP POLICY IF EXISTS avatars_insert_own ON storage.objects;
CREATE POLICY avatars_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'Avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS avatars_update_own ON storage.objects;
CREATE POLICY avatars_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'Avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS avatars_delete_own ON storage.objects;
CREATE POLICY avatars_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'Avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
